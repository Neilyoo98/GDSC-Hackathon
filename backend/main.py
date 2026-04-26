"""AUBI Backend — FastAPI app.

Endpoints:
  POST /agents                  create agent from GitHub
  GET  /agents                  list all agents
  GET  /agents/{id}             get agent + constitution
  POST /agents/{id}/query       query agent's context for an incident
  POST /constitution/{id}       add fact to constitution
  PATCH /constitution/{id}      update/add fact
  GET  /ownership               file → owner lookup
  POST /incidents/run           blocking incident run
  GET  /incidents/stream        SSE stream of incident graph
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langgraph.types import Command
from pydantic import BaseModel

from graphs.incident_graph import aubi_graph
from constitution.store import ConstitutionStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AUBI Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_store: ConstitutionStore | None = None

def get_store() -> ConstitutionStore:
    global _store
    if _store is None:
        _store = ConstitutionStore()
    return _store

# ---------------------------------------------------------------------------
# In-memory agent registry (demo — swap for Firestore/Postgres in prod)
# ---------------------------------------------------------------------------

_agents: dict[str, dict[str, Any]] = {}  # id → agent record
_ownership_map: dict[str, str] = {}      # filepath_prefix → agent_id


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class CreateAgentRequest(BaseModel):
    github_username: str
    name: str | None = None
    role: str | None = None


class QueryAgentRequest(BaseModel):
    incident_text: str


class IncidentRequest(BaseModel):
    incident_text: str


class ConstitutionFactRequest(BaseModel):
    fact: dict[str, Any]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_constitution_from_store(user_id: str) -> dict[str, Any]:
    """Fetch constitution facts from Qdrant grouped by category."""
    try:
        return get_store().get_by_user(user_id, "hackathon")
    except Exception as e:
        logger.warning("Could not fetch constitution for %s: %s", user_id, e)
    return {}


def _index_ownership_facts(agent_id: str, facts: list[dict[str, Any]]) -> None:
    """Populate the in-memory prefix fallback from constitution ownership facts."""
    for fact in facts:
        if fact.get("category") != "code_ownership" or fact.get("predicate") != "owns":
            continue
        obj = str(fact.get("object", ""))
        match = re.search(r"([A-Za-z0-9_.-]+/)", obj)
        if match:
            _ownership_map[match.group(1)] = agent_id


def _register_agent_record(
    *,
    agent_id: str,
    github_username: str,
    name: str,
    role: str,
    facts: list[dict[str, Any]],
    github_data_summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    record = {
        "id": agent_id,
        "github_username": github_username,
        "name": name,
        "role": role,
        "github_data_summary": github_data_summary or {},
        "constitution_facts": facts,
    }
    _agents[agent_id] = record
    _index_ownership_facts(agent_id, facts)
    return record


def _load_seeded_demo_agents() -> None:
    """Expose seed_demo.py agents through /agents even before POST /agents is used."""
    if _agents:
        return
    try:
        from seed_demo import DEMO_AGENTS
    except Exception as e:
        logger.warning("Could not load demo agents: %s", e)
        return

    for agent in DEMO_AGENTS:
        _register_agent_record(
            agent_id=agent["id"],
            github_username=agent["github_username"],
            name=agent["name"],
            role=agent["role"],
            facts=agent["facts"],
            github_data_summary={"source": "seed_demo.py"},
        )


def _extract_interrupt_payload(result: dict[str, Any]) -> dict[str, Any] | None:
    interrupts = result.get("__interrupt__")
    if not interrupts:
        return None
    first = interrupts[0] if isinstance(interrupts, (list, tuple)) else interrupts
    value = getattr(first, "value", None)
    return value if isinstance(value, dict) else None


def _extract_interrupt_payload_from_chunk(chunk: dict[str, Any]) -> dict[str, Any] | None:
    interrupts = chunk.get("__interrupt__")
    if not interrupts:
        return None
    first = interrupts[0] if isinstance(interrupts, (list, tuple)) else interrupts
    value = getattr(first, "value", None)
    return value if isinstance(value, dict) else None


def _fallback_agent_context(agent: dict[str, Any], incident_text: str) -> str:
    """Constitution-only response when LLM credentials are unavailable."""
    text = incident_text.lower()
    facts = agent.get("constitution_facts", [])
    relevant: list[dict[str, Any]] = []
    for fact in facts:
        haystack = f"{fact.get('predicate', '')} {fact.get('object', '')}".lower()
        if fact.get("category") in {"known_issues", "code_ownership", "current_focus"}:
            if any(token in haystack for token in text.replace("/", " ").split()):
                relevant.append(fact)
    if not relevant:
        relevant = [
            fact for fact in facts
            if fact.get("category") in {"known_issues", "code_ownership", "current_focus"}
        ][:3]

    if not relevant:
        return f"{agent['name']} has no specific matching constitution facts for this incident."

    facts_text = "; ".join(f"{fact.get('predicate')}: {fact.get('object')}" for fact in relevant[:3])
    return f"Yes/partial. {agent['name']}'s constitution has relevant context: {facts_text}. Check that area first."


_load_seeded_demo_agents()


# ---------------------------------------------------------------------------
# Agent endpoints
# ---------------------------------------------------------------------------

@app.post("/agents")
async def create_agent(req: CreateAgentRequest):
    """Create an AUBI agent from a GitHub username. Builds constitution from GitHub."""
    from ingestion.github_ingest import ingest_developer, build_ownership_map
    from constitution.builder import build_constitution_from_github

    agent_id = str(uuid4())[:8]

    # 1. Pull GitHub data
    try:
        github_data = ingest_developer(req.github_username)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # 2. Build constitution facts via Gemini structured output
    facts = await build_constitution_from_github(github_data)

    # 3. Store facts in Qdrant
    try:
        get_store().upsert_facts(agent_id, "hackathon", facts)
    except Exception as e:
        logger.warning("Could not store constitution in Qdrant: %s", e)

    # 4. Register agent in-memory
    agent_record = _register_agent_record(
        agent_id=agent_id,
        github_username=req.github_username,
        name=req.name or github_data.get("name", req.github_username),
        role=req.role or "Software Engineer",
        facts=facts,
        github_data_summary={
            "commit_count": github_data.get("commit_count", 0),
            "pr_count": github_data.get("pr_count", 0),
            "top_files": github_data.get("top_files", [])[:5],
            "languages": github_data.get("languages", [])[:5],
        },
    )

    # 5. Update ownership map
    new_map = build_ownership_map([github_data])
    for path, owner_username in new_map.items():
        if owner_username == req.github_username:
            _ownership_map[path] = agent_id

    return {**agent_record, "facts_stored": len(facts)}


@app.get("/agents")
async def list_agents():
    return list(_agents.values())


@app.get("/agents/{agent_id}")
async def get_agent(agent_id: str):
    if agent_id not in _agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent = _agents[agent_id].copy()
    # Enrich with live constitution from Qdrant
    live_constitution = _get_constitution_from_store(agent_id)
    if live_constitution:
        agent["constitution"] = live_constitution
    else:
        # Fall back to in-memory facts
        facts = agent.get("constitution_facts", [])
        grouped: dict[str, list] = {}
        for f in facts:
            cat = f.get("category", "general")
            grouped.setdefault(cat, []).append(f)
        agent["constitution"] = grouped
    return agent


@app.post("/agents/{agent_id}/query")
async def query_agent(agent_id: str, req: QueryAgentRequest):
    """Ask an agent what context it has relevant to an incident."""
    if agent_id not in _agents:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = _agents[agent_id]
    constitution = json.dumps(agent.get("constitution_facts", [])[:20], indent=2)

    try:
        from langchain_anthropic import ChatAnthropic
        from langchain_core.messages import HumanMessage, SystemMessage
        haiku = ChatAnthropic(model=os.getenv("ANTHROPIC_HAIKU_MODEL", "claude-haiku-20240307"))
        response = await haiku.ainvoke([
            SystemMessage(content=(
                f"You are {agent['name']}'s AI representative.\n"
                f"Their constitution:\n{constitution}\n\n"
                "Answer briefly: Is this incident in their domain? "
                "What context do they have? What would they say when paged?"
            )),
            HumanMessage(content=f"Incident: {req.incident_text}"),
        ])
        context = response.content
    except Exception as e:
        logger.warning("Agent query LLM failed for %s; using constitution fallback: %s", agent_id, e)
        context = _fallback_agent_context(agent, req.incident_text)

    return {"agent_id": agent_id, "agent_name": agent["name"], "context": context}


# ---------------------------------------------------------------------------
# Constitution endpoints
# ---------------------------------------------------------------------------

@app.get("/constitution/{agent_id}")
async def get_constitution(agent_id: str):
    """Return an agent's constitution facts grouped by category."""
    live_constitution = _get_constitution_from_store(agent_id)
    if live_constitution:
        return live_constitution
    if agent_id not in _agents:
        raise HTTPException(status_code=404, detail="Agent not found")

    grouped: dict[str, list[dict[str, Any]]] = {}
    for fact in _agents[agent_id].get("constitution_facts", []):
        grouped.setdefault(fact.get("category", "general"), []).append(fact)
    return grouped


@app.patch("/constitution/{agent_id}")
async def patch_constitution(agent_id: str, req: ConstitutionFactRequest):
    """Add a fact to an agent's constitution (called by memory_updater)."""
    if agent_id in _agents:
        _agents[agent_id].setdefault("constitution_facts", []).append(req.fact)
    try:
        get_store().upsert_facts(agent_id, "hackathon", [req.fact])
    except Exception as e:
        logger.warning("Could not patch constitution in Qdrant: %s", e)
    return {"status": "ok", "agent_id": agent_id}


# ---------------------------------------------------------------------------
# Ownership endpoint
# ---------------------------------------------------------------------------

@app.get("/ownership")
async def get_ownership(filepath: str):
    """Return which agent owns a filepath prefix."""
    try:
        owner_agent_id, confidence, evidence = get_store().search_ownership(filepath, "hackathon")
        if owner_agent_id:
            return {
                "owner_agent_id": owner_agent_id,
                "confidence": confidence,
                "evidence_facts": evidence,
            }
    except Exception as e:
        logger.warning("Qdrant ownership lookup failed, using in-memory fallback: %s", e)

    # Check exact match first, then prefix match
    if filepath in _ownership_map:
        return {"owner_agent_id": _ownership_map[filepath], "confidence": 0.9}
    for prefix, agent_id in _ownership_map.items():
        if filepath.startswith(prefix):
            return {"owner_agent_id": agent_id, "confidence": 0.9}
        if prefix.startswith(filepath.split("/")[0]):
            return {"owner_agent_id": agent_id, "confidence": 0.7}
    return {"owner_agent_id": None, "confidence": 0.0}


# ---------------------------------------------------------------------------
# Incident endpoints
# ---------------------------------------------------------------------------

class IssueRequest(BaseModel):
    issue_url: str | None = None
    incident_text: str | None = None
    thread_id: str | None = None
    auto_approve: bool = False


GRAPH_NODES = {
    "issue_reader", "ownership_router", "query_single_agent",
    "code_reader", "fix_generator", "test_runner", "approval_gate", "pr_pusher",
}


@app.post("/incidents/run")
async def run_incident(req: IssueRequest):
    """Blocking run. Stops at approval unless auto_approve=true."""
    state_input: dict[str, Any] = {}
    if req.issue_url:
        state_input["issue_url"] = req.issue_url
    elif req.incident_text:
        state_input["incident_text"] = req.incident_text
    else:
        raise HTTPException(status_code=400, detail="Provide issue_url or incident_text")

    thread_id = req.thread_id or uuid4().hex
    config = {"configurable": {"thread_id": thread_id}}
    result = await aubi_graph.ainvoke(state_input, config=config)

    interrupt_payload = _extract_interrupt_payload(result)
    if interrupt_payload and req.auto_approve:
        result = await aubi_graph.ainvoke(
            Command(resume={"approved": True}),
            config=config,
        )
        interrupt_payload = None

    if interrupt_payload:
        return {
            "thread_id": thread_id,
            "awaiting_approval": True,
            "approval": interrupt_payload,
            "patch_diff": result.get("patch_diff"),
            "fix_explanation": result.get("fix_explanation"),
            "test_output": result.get("test_output"),
            "tests_passed": result.get("tests_passed"),
            "owners": result.get("owner_ids"),
            "agent_messages": result.get("agent_messages", []),
            "routing_evidence": result.get("routing_evidence", []),
            "stream_log": result.get("stream_log", []),
        }

    return {
        "thread_id":         thread_id,
        "pr_url":           result.get("pr_url"),
        "patch_diff":       result.get("patch_diff"),
        "fix_explanation":  result.get("fix_explanation"),
        "test_output":      result.get("test_output"),
        "tests_passed":     result.get("tests_passed"),
        "slack_message":    result.get("slack_message"),
        "postmortem":       result.get("postmortem"),
        "owners":           result.get("owner_ids"),
        "agent_messages":   result.get("agent_messages", []),
        "routing_evidence": result.get("routing_evidence", []),
        "learned_facts":    result.get("learned_facts", []),
        "stream_log":       result.get("stream_log", []),
    }


@app.get("/incidents/stream")
async def stream_incident(
    issue_url: str | None = None,
    incident_text: str | None = None,
    thread_id: str | None = None,
):
    """SSE stream of the full AUBI graph execution."""

    state_input: dict[str, Any] = {}
    if issue_url:
        state_input["issue_url"] = issue_url
    elif incident_text:
        state_input["incident_text"] = incident_text
    else:
        raise HTTPException(status_code=400, detail="Provide issue_url or incident_text")
    run_thread_id = thread_id or uuid4().hex
    config = {"configurable": {"thread_id": run_thread_id}}

    async def event_generator():
        interrupted = False
        try:
            yield f"data: {json.dumps({'event': 'thread', 'data': {'thread_id': run_thread_id}})}\n\n"
            async for event in aubi_graph.astream_events(state_input, config=config, version="v2"):
                kind = event.get("event", "")
                name = event.get("name", "")
                data = event.get("data", {})

                if kind == "on_chain_start" and name in GRAPH_NODES:
                    yield f"data: {json.dumps({'event': 'node_start', 'node': name, 'data': None})}\n\n"

                elif kind == "on_chain_stream" and name == "LangGraph":
                    payload = _extract_interrupt_payload_from_chunk(data.get("chunk", {}))
                    if payload:
                        payload = {**payload, "thread_id": run_thread_id}
                        yield f"data: {json.dumps({'event': 'awaiting_approval', 'data': payload}, default=str)}\n\n"
                        interrupted = True
                        break

                elif kind == "on_chain_end" and name in GRAPH_NODES:
                    output = data.get("output", {})

                    # Agent comm feed messages
                    for msg in (output.get("agent_messages") or []):
                        yield f"data: {json.dumps({'event': 'agent_message', 'data': msg})}\n\n"

                    # Routing evidence — "Why Alice?" panel
                    for ev in (output.get("routing_evidence") or []):
                        yield f"data: {json.dumps({'event': 'routing_evidence', 'data': ev})}\n\n"

                    # "AUBI learned" strip — fires after pr_pusher
                    for lf in (output.get("learned_facts") or []):
                        yield f"data: {json.dumps({'event': 'aubi_learned', 'data': lf})}\n\n"

                    yield f"data: {json.dumps({'event': 'node_done', 'node': name, 'data': output}, default=str)}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'node': 'graph', 'data': str(e)})}\n\n"

        yield f"data: {json.dumps({'event': 'complete', 'data': {'interrupted': interrupted, 'thread_id': run_thread_id}})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/incidents/approve")
async def approve_incident(thread_id: str, approved: bool = True):
    """Resume a paused graph after human approval/rejection."""
    try:
        result = await aubi_graph.ainvoke(
            Command(resume={"approved": approved}),
            config={"configurable": {"thread_id": thread_id}},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not resume incident {thread_id}: {e}") from e
    return {
        "thread_id": thread_id,
        "approved": approved,
        "pr_url": result.get("pr_url"),
        "branch_name": result.get("branch_name"),
        "patch_diff": result.get("patch_diff"),
        "fix_explanation": result.get("fix_explanation"),
        "test_output": result.get("test_output"),
        "tests_passed": result.get("tests_passed"),
        "learned_facts": result.get("learned_facts", []),
        "stream_log": result.get("stream_log", []),
    }


@app.get("/github/poll")
async def poll_github():
    """Return the latest open issue on the demo repo (for live demo poller)."""
    demo_repo = os.getenv("DEMO_REPO", "")
    if not demo_repo:
        return {"issue": None}
    try:
        from ingestion.github_issue import get_latest_open_issue
        return {"issue": get_latest_open_issue(demo_repo)}
    except Exception as e:
        return {"issue": None, "error": str(e)}


@app.get("/health")
async def health():
    return {"status": "ok"}
