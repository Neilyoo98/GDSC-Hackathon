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
from typing import Any
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from graphs.incident_graph import incident_graph

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AUBI Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

KNOWLEDGE_URL = os.getenv("KNOWLEDGE_SERVICE_URL", "http://localhost:8002")

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

async def _get_constitution_from_knowledge(user_id: str) -> dict[str, Any]:
    """Fetch constitution facts from knowledge service grouped by category."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{KNOWLEDGE_URL}/constitution/{user_id}")
            if resp.status_code == 200:
                return resp.json()
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

    # 3. Post facts to knowledge service (Qdrant)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.post(f"{KNOWLEDGE_URL}/constitution/store", json={
                "user_id": agent_id,
                "tenant_id": "hackathon",
                "facts": facts,
            })
    except Exception as e:
        logger.warning("Could not store constitution in knowledge service: %s", e)

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
    # Enrich with live constitution from knowledge service
    live_constitution = await _get_constitution_from_knowledge(agent_id)
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
    from langchain_anthropic import ChatAnthropic
    haiku = ChatAnthropic(model="claude-haiku-20240307")

    response = await haiku.ainvoke([
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
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(f"{KNOWLEDGE_URL}/constitution/store", json={
                "user_id": agent_id,
                "tenant_id": "hackathon",
                "facts": [req.fact],
            })
    except Exception as e:
        logger.warning("Could not patch constitution in knowledge service: %s", e)
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

@app.post("/incidents/run")
async def run_incident(req: IncidentRequest):
    """Blocking incident run — returns full result."""
    result = await incident_graph.ainvoke({"incident_text": req.incident_text})
    return {
        "slack_message": result.get("slack_message"),
        "postmortem": result.get("postmortem"),
        "owners": result.get("owner_ids"),
        "stream_log": result.get("stream_log", []),
    }


@app.get("/incidents/stream")
async def stream_incident(incident_text: str):
    """SSE stream of incident graph execution."""

    async def event_generator():
        try:
            async for event in incident_graph.astream_events(
                {"incident_text": incident_text},
                version="v2",
            ):
                kind = event.get("event")
                name = event.get("name", "")
                data = event.get("data", {})

                if kind == "on_chain_start" and name in (
                    "incident_analyzer", "ownership_router",
                    "agent_querier", "response_drafter", "memory_updater"
                ):
                    payload = json.dumps({"node": name, "status": "running", "output": None})
                    yield f"data: {payload}\n\n"

                elif kind == "on_chain_end" and name in (
                    "incident_analyzer", "ownership_router",
                    "agent_querier", "response_drafter", "memory_updater"
                ):
                    output = data.get("output", {})
                    payload = json.dumps({"node": name, "status": "done", "output": output})
                    yield f"data: {payload}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'node': 'error', 'status': 'error', 'output': str(e)})}\n\n"

        yield f"data: {json.dumps({'node': 'complete', 'status': 'done', 'output': None})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/health")
async def health():
    return {"status": "ok"}
