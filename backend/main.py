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

    # 2. Build constitution facts via GPT-5.5
    facts = await build_constitution_from_github(github_data)

    # 3. Store facts in Qdrant
    try:
        get_store().upsert_facts(agent_id, "hackathon", facts)
    except Exception as e:
        logger.warning("Could not store constitution in Qdrant: %s", e)

    # 4. Register agent in-memory
    agent_record = {
        "id": agent_id,
        "github_username": req.github_username,
        "name": req.name or github_data.get("name", req.github_username),
        "role": req.role or "Software Engineer",
        "github_data_summary": {
            "commit_count": github_data.get("commit_count", 0),
            "pr_count": github_data.get("pr_count", 0),
            "top_files": github_data.get("top_files", [])[:5],
            "languages": github_data.get("languages", [])[:5],
        },
        "constitution_facts": facts,
    }
    _agents[agent_id] = agent_record

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

    from langchain_core.messages import HumanMessage, SystemMessage
    from langchain_openai import ChatOpenAI
    gpt55 = ChatOpenAI(model="gpt-5.5", base_url="https://us.api.openai.com/v1", streaming=False, use_responses_api=True)

    response = await gpt55.ainvoke([
        SystemMessage(content=(
            f"You are {agent['name']}'s AI representative.\n"
            f"Their constitution:\n{constitution}\n\n"
            "Answer briefly: Is this incident in their domain? "
            "What context do they have? What would they say when paged?"
        )),
        HumanMessage(content=f"Incident: {req.incident_text}"),
    ])
    return {"agent_id": agent_id, "agent_name": agent["name"], "context": response.content}


# ---------------------------------------------------------------------------
# Constitution endpoints
# ---------------------------------------------------------------------------

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
    # Check exact match first, then prefix match
    if filepath in _ownership_map:
        return {"owner_agent_id": _ownership_map[filepath], "confidence": 0.9}
    for prefix, agent_id in _ownership_map.items():
        if filepath.startswith(prefix) or prefix.startswith(filepath.split("/")[0]):
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
    """Blocking run — returns full result including PR URL."""
    state_input: dict[str, Any] = {}
    if req.issue_url:
        state_input["issue_url"] = req.issue_url
    else:
        state_input["incident_text"] = req.incident_text

    result = await aubi_graph.ainvoke(state_input)
    return {
        "pr_url":           result.get("pr_url"),
        "patch_diff":       result.get("patch_diff"),
        "fix_explanation":  result.get("fix_explanation"),
        "slack_message":    result.get("slack_message"),
        "postmortem":       result.get("postmortem"),
        "owners":           result.get("owner_ids"),
        "agent_messages":   result.get("agent_messages", []),
        "routing_evidence": result.get("routing_evidence", []),
        "learned_facts":    result.get("learned_facts", []),
        "stream_log":       result.get("stream_log", []),
    }


@app.get("/incidents/stream")
async def stream_incident(issue_url: str | None = None, incident_text: str | None = None):
    """SSE stream of the full AUBI graph execution."""

    state_input: dict[str, Any] = {}
    if issue_url:
        state_input["issue_url"] = issue_url
    else:
        state_input["incident_text"] = incident_text

    async def event_generator():
        try:
            async for event in aubi_graph.astream_events(state_input, version="v2"):
                kind = event.get("event", "")
                name = event.get("name", "")
                data = event.get("data", {})

                if kind == "on_chain_start" and name in GRAPH_NODES:
                    yield f"data: {json.dumps({'event': 'node_start', 'node': name, 'data': None})}\n\n"

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

                    yield f"data: {json.dumps({'event': 'node_done', 'node': name, 'data': output})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'node': 'graph', 'data': str(e)})}\n\n"

        yield f"data: {json.dumps({'event': 'complete', 'data': None})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


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
