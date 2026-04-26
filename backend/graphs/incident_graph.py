"""AUBI Incident Routing Graph.

GPT-5.5 as the orchestrator (planning + routing + drafting).
Claude Haiku for fast per-agent constitution queries.

Flow:
  incident_text → analyze → route_to_owners → query_agents → draft_response → update_memory
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langgraph.graph import StateGraph, END

from .state import AUBIIncidentState

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

# GPT-5.5 for orchestration (planning, routing, drafting)
gpt55 = ChatOpenAI(
    model="gpt-5.5",
    base_url="https://us.api.openai.com/v1",
    streaming=True,
    stream_usage=True,
    use_responses_api=True,
)

# Claude Haiku for fast per-agent constitution queries
haiku = ChatAnthropic(model="claude-haiku-20240307")

KNOWLEDGE_URL = os.getenv("KNOWLEDGE_SERVICE_URL", "http://localhost:8002")
AGENTS_URL = os.getenv("AGENTS_SERVICE_URL", "http://localhost:8000")


# ---------------------------------------------------------------------------
# Node: incident_analyzer
# ---------------------------------------------------------------------------

ANALYZE_SYSTEM = """\
You are analyzing a production incident report. Extract structured information.
Return JSON only — no markdown, no explanation.

Required fields:
{
  "affected_service": "name of the service/module failing",
  "affected_files": ["likely file paths based on service name, e.g. billing/, auth/"],
  "error_type": "500 | timeout | crash | auth_failure | null_pointer | etc.",
  "urgency": "P1 | P2 | P3",
  "started_at": "time mentioned or null"
}
"""

async def incident_analyzer(state: AUBIIncidentState) -> dict[str, Any]:
    logger.info("incident_analyzer: analyzing incident")
    response = await gpt55.ainvoke([
        SystemMessage(content=ANALYZE_SYSTEM),
        HumanMessage(content=f"Incident: {state['incident_text']}"),
    ])
    try:
        raw = response.content
        start = raw.find("{")
        end = raw.rfind("}") + 1
        data = json.loads(raw[start:end])
    except Exception:
        data = {"affected_service": "unknown", "affected_files": [], "error_type": "unknown", "urgency": "P2"}

    return {
        "affected_service": data.get("affected_service"),
        "affected_files": data.get("affected_files", []),
        "error_type": data.get("error_type"),
        "urgency": data.get("urgency", "P2"),
        "stream_log": [f"🔍 Analyzer: {data.get('affected_service', '?')} — {data.get('error_type', '?')} ({data.get('urgency', 'P2')})"],
    }


# ---------------------------------------------------------------------------
# Node: ownership_router
# ---------------------------------------------------------------------------

async def ownership_router(state: AUBIIncidentState) -> dict[str, Any]:
    """Query constitution store for code ownership facts matching affected files."""
    import httpx

    logger.info("ownership_router: finding owners for %s", state.get("affected_files"))
    owner_ids: list[str] = []

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            for filepath in (state.get("affected_files") or []):
                resp = await client.get(f"{AGENTS_URL}/ownership", params={"filepath": filepath})
                if resp.status_code == 200:
                    data = resp.json()
                    if owner_id := data.get("owner_agent_id"):
                        if owner_id not in owner_ids:
                            owner_ids.append(owner_id)
    except Exception as e:
        logger.warning("ownership_router error: %s", e)

    # Fallback: return first registered agent if no owners found
    if not owner_ids:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{AGENTS_URL}/agents")
                if resp.status_code == 200:
                    agents = resp.json()
                    if agents:
                        owner_ids = [agents[0]["id"]]
        except Exception:
            pass

    return {
        "owner_ids": owner_ids,
        "stream_log": [f"📍 Router: Found {len(owner_ids)} owner(s) — {', '.join(owner_ids)}"],
    }


# ---------------------------------------------------------------------------
# Node: agent_querier
# ---------------------------------------------------------------------------

QUERY_SYSTEM = """\
You are {agent_name}'s AI representative. Their Context Constitution:

{constitution}

An incident has occurred:
{incident_summary}

Answer briefly:
1. Is this in their domain? (yes/no/partial)
2. What relevant context do they have?
3. What would they say when paged?

Be concise. Speak as their knowledgeable representative.
"""

async def agent_querier(state: AUBIIncidentState) -> dict[str, Any]:
    """Query each identified agent for their context on the incident."""
    import httpx

    incident_summary = (
        f"Service: {state.get('affected_service')}, "
        f"Error: {state.get('error_type')}, "
        f"Files: {state.get('affected_files')}, "
        f"Urgency: {state.get('urgency')}"
    )

    contexts: list[dict[str, Any]] = []
    stream_log: list[str] = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        for owner_id in (state.get("owner_ids") or []):
            try:
                # Get agent constitution
                resp = await client.get(f"{AGENTS_URL}/agents/{owner_id}")
                if resp.status_code != 200:
                    continue
                agent_data = resp.json()
                agent_name = agent_data.get("name", owner_id)
                constitution = json.dumps(agent_data.get("constitution", {}), indent=2)

                # Ask Haiku for context
                response = await haiku.ainvoke([
                    SystemMessage(content=QUERY_SYSTEM.format(
                        agent_name=agent_name,
                        constitution=constitution,
                        incident_summary=incident_summary,
                    )),
                ])
                context_text = response.content

                contexts.append({
                    "agent_id": owner_id,
                    "agent_name": agent_name,
                    "context": context_text,
                    "communication_pref": agent_data.get("constitution", {})
                        .get("collaboration", {}).get("communication_pref", ""),
                })
                stream_log.append(f"🤖 Agent [{agent_name}]: {context_text[:120]}...")
            except Exception as e:
                logger.warning("agent_querier error for %s: %s", owner_id, e)

    return {
        "agent_contexts": contexts,
        "stream_log": stream_log,
    }


# ---------------------------------------------------------------------------
# Node: response_drafter
# ---------------------------------------------------------------------------

DRAFT_SYSTEM = """\
You are drafting an incident response.

Primary responder: {primary_name}
Their communication style: "{comm_style}"
Their known context: {agent_context}

Incident: {incident_summary}

Write two things:

SLACK_MESSAGE:
<Write a Slack message AS IF you are {primary_name}. Match their style.
Be specific about what you know and what you're investigating.>

POSTMORTEM:
<Markdown postmortem skeleton:
## Incident: {incident_summary}
### Timeline
- [TIME]: Incident detected
### Root Cause
TBD
### Impact
TBD
### Action Items
- [ ] Owner: {primary_name} — investigate {affected_service}
>
"""

async def response_drafter(state: AUBIIncidentState) -> dict[str, Any]:
    """Draft Slack message and postmortem using GPT-5.5."""
    logger.info("response_drafter: drafting response")

    contexts = state.get("agent_contexts") or []
    primary = contexts[0] if contexts else {"agent_name": "Unknown", "context": "", "communication_pref": ""}
    incident_summary = (
        f"Service: {state.get('affected_service')}, "
        f"Error: {state.get('error_type')}, "
        f"Urgency: {state.get('urgency')}"
    )

    response = await gpt55.ainvoke([
        SystemMessage(content=DRAFT_SYSTEM.format(
            primary_name=primary.get("agent_name", "Unknown"),
            comm_style=primary.get("communication_pref", ""),
            agent_context=primary.get("context", ""),
            incident_summary=incident_summary,
            affected_service=state.get("affected_service", "unknown"),
        )),
    ])

    raw = response.content
    slack_msg, postmortem = "", ""
    if "SLACK_MESSAGE:" in raw and "POSTMORTEM:" in raw:
        parts = raw.split("POSTMORTEM:", 1)
        slack_msg = parts[0].replace("SLACK_MESSAGE:", "").strip()
        postmortem = parts[1].strip()
    else:
        slack_msg = raw
        postmortem = f"## Incident\n{incident_summary}\n\n### Root Cause\nTBD\n\n### Action Items\n- [ ] Investigate {state.get('affected_service')}"

    return {
        "slack_message": slack_msg,
        "postmortem": postmortem,
        "stream_log": [f"✉️ Drafted Slack message ({len(slack_msg)} chars) + postmortem"],
    }


# ---------------------------------------------------------------------------
# Node: memory_updater
# ---------------------------------------------------------------------------

async def memory_updater(state: AUBIIncidentState) -> dict[str, Any]:
    """Post-incident: update constitution facts for involved agents."""
    import httpx

    updated: list[str] = []
    incident_summary = (
        f"Incident involving {state.get('affected_service')} ({state.get('error_type')}), "
        f"urgency {state.get('urgency')}. Resolution drafted."
    )

    async with httpx.AsyncClient(timeout=10.0) as client:
        for ctx in (state.get("agent_contexts") or []):
            agent_id = ctx.get("agent_id")
            if not agent_id:
                continue
            try:
                await client.patch(
                    f"{AGENTS_URL}/constitution/{agent_id}",
                    json={"fact": {
                        "subject": agent_id,
                        "predicate": "resolved_incident",
                        "object": incident_summary,
                        "category": "episodes",
                        "confidence": 0.9,
                    }},
                )
                updated.append(agent_id)
            except Exception as e:
                logger.warning("memory_updater error for %s: %s", agent_id, e)

    return {
        "memory_updates": updated,
        "stream_log": [f"💾 Memory updated for: {', '.join(updated) or 'none'}"],
    }


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------

def build_incident_graph():
    builder = StateGraph(AUBIIncidentState)

    builder.add_node("incident_analyzer", incident_analyzer)
    builder.add_node("ownership_router", ownership_router)
    builder.add_node("agent_querier", agent_querier)
    builder.add_node("response_drafter", response_drafter)
    builder.add_node("memory_updater", memory_updater)

    builder.set_entry_point("incident_analyzer")
    builder.add_edge("incident_analyzer", "ownership_router")
    builder.add_edge("ownership_router", "agent_querier")
    builder.add_edge("agent_querier", "response_drafter")
    builder.add_edge("response_drafter", "memory_updater")
    builder.add_edge("memory_updater", END)

    return builder.compile()


incident_graph = build_incident_graph()
