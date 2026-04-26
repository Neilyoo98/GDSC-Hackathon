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
import shutil
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langgraph.types import Command
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

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
# In-memory agent registry for agents created during this backend process.
# ---------------------------------------------------------------------------

_agents: dict[str, dict[str, Any]] = {}  # id → agent record
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
    return get_store().get_by_user(user_id, "hackathon")


def _flatten_constitution(grouped: dict[str, Any]) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    for value in grouped.values():
        if isinstance(value, list):
            facts.extend(fact for fact in value if isinstance(fact, dict))
    return facts


def _group_facts_by_category(facts: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for fact in facts:
        grouped.setdefault(str(fact.get("category", "general")), []).append(fact)
    return grouped


def _agent_record_from_facts(agent_id: str, facts: list[dict[str, Any]]) -> dict[str, Any]:
    username = str(next((fact.get("subject") for fact in facts if fact.get("subject")), agent_id))
    expertise = next((fact.get("object") for fact in facts if fact.get("category") == "expertise"), "")
    return {
        "id": agent_id,
        "github_username": username,
        "name": username,
        "role": str(expertise or "Software Engineer"),
        "github_data_summary": {},
        "constitution_facts": facts,
        "constitution": _group_facts_by_category(facts),
    }


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
    return record


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


_gpt55 = None


def get_gpt55():
    global _gpt55
    if _gpt55 is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        from langchain_openai import ChatOpenAI
        _gpt55 = ChatOpenAI(
            model=os.getenv("OPENAI_MODEL", "gpt-5.5"),
            api_key=api_key,
            base_url=os.getenv("OPENAI_BASE_URL", "https://us.api.openai.com/v1"),
            streaming=False,
            use_responses_api=True,
        )
    return _gpt55


# ---------------------------------------------------------------------------
# Agent endpoints
# ---------------------------------------------------------------------------

@app.post("/agents")
async def create_agent(req: CreateAgentRequest):
    """Create an AUBI agent from a GitHub username. Builds constitution from GitHub."""
    from ingestion.github_ingest import ingest_developer
    from constitution.builder import build_constitution_from_github

    agent_id = str(uuid4())[:8]

    # 1. Pull GitHub data
    try:
        github_data = ingest_developer(req.github_username)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # 2. Build constitution facts via Gemini structured output
    facts = await build_constitution_from_github(github_data)

    # 3. Store facts in Qdrant. This is a required part of agent creation.
    stored_count = get_store().upsert_facts(agent_id, "hackathon", facts)
    if stored_count != len(facts):
        raise HTTPException(
            status_code=500,
            detail=f"Stored {stored_count} of {len(facts)} constitution facts",
        )

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

    return {**agent_record, "facts_stored": len(facts)}


@app.get("/agents")
async def list_agents():
    records = {agent_id: agent.copy() for agent_id, agent in _agents.items()}
    for agent_id, facts in get_store().list_user_facts("hackathon").items():
        if agent_id not in records:
            records[agent_id] = _agent_record_from_facts(agent_id, facts)
        else:
            records[agent_id]["constitution_facts"] = facts
            records[agent_id]["constitution"] = _group_facts_by_category(facts)
    return list(records.values())


@app.get("/agents/{agent_id}")
async def get_agent(agent_id: str):
    live_constitution = _get_constitution_from_store(agent_id)
    if not live_constitution:
        raise HTTPException(status_code=404, detail=f"No constitution facts found for agent {agent_id}")
    if agent_id in _agents:
        agent = _agents[agent_id].copy()
    else:
        agent = _agent_record_from_facts(agent_id, _flatten_constitution(live_constitution))
    agent["constitution"] = live_constitution
    agent["constitution_facts"] = _flatten_constitution(live_constitution)
    return agent


@app.post("/agents/{agent_id}/query")
async def query_agent(agent_id: str, req: QueryAgentRequest):
    """Ask an agent what context it has relevant to an incident."""
    facts = _flatten_constitution(_get_constitution_from_store(agent_id))
    if not facts:
        raise HTTPException(status_code=404, detail=f"No constitution facts found for agent {agent_id}")
    agent = _agents.get(agent_id) or _agent_record_from_facts(agent_id, facts)
    constitution = json.dumps(facts[:20], indent=2)

    from langchain_core.messages import HumanMessage, SystemMessage
    response = await get_gpt55().ainvoke([
        SystemMessage(content=(
            f"You are {agent['name']}'s AI representative.\n"
            f"Their constitution:\n{constitution}\n\n"
            "Answer briefly: Is this incident in their domain? "
            "What context do they have? What would they say when paged?"
        )),
        HumanMessage(content=f"Incident: {req.incident_text}"),
    ])
    context = response.content

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
    raise HTTPException(status_code=404, detail=f"No constitution facts found for agent {agent_id}")


@app.patch("/constitution/{agent_id}")
async def patch_constitution(agent_id: str, req: ConstitutionFactRequest):
    """Add a fact to an agent's constitution (called by memory_updater)."""
    stored_count = get_store().upsert_facts(agent_id, "hackathon", [req.fact])
    if stored_count != 1:
        raise HTTPException(status_code=500, detail="Constitution fact was not stored")
    if agent_id in _agents:
        _agents[agent_id].setdefault("constitution_facts", []).append(req.fact)
    return {"status": "ok", "agent_id": agent_id}


# ---------------------------------------------------------------------------
# Ownership endpoint
# ---------------------------------------------------------------------------

@app.get("/ownership")
async def get_ownership(filepath: str):
    """Return which agent owns a filepath prefix."""
    try:
        owner_agent_id, confidence, evidence = get_store().search_ownership(filepath, "hackathon")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Qdrant ownership lookup failed: {e}") from e

    return {
        "owner_agent_id": owner_agent_id,
        "confidence": confidence,
        "evidence_facts": evidence,
    }


# ---------------------------------------------------------------------------
# Incident endpoints
# ---------------------------------------------------------------------------

class IssueRequest(BaseModel):
    issue_url: str | None = None
    incident_text: str | None = None
    repo_name: str | None = None
    issue_number: int | None = None
    thread_id: str | None = None
    auto_approve: bool = False


GRAPH_NODES = {
    "issue_reader", "ownership_router", "query_single_agent",
    "code_reader", "fix_generator", "test_runner", "approval_gate", "pr_pusher",
}


def _target_repo() -> str:
    return os.getenv("TARGET_REPO") or os.getenv("GITHUB_REPO", "")


def _state_input_from_issue_request(req: IssueRequest) -> dict[str, Any]:
    state_input: dict[str, Any] = {}
    if req.issue_url:
        state_input["issue_url"] = req.issue_url
        return state_input

    if not req.incident_text:
        raise HTTPException(status_code=400, detail="Provide issue_url or incident_text")

    if not req.repo_name or req.issue_number is None:
        raise HTTPException(
            status_code=400,
            detail="incident_text runs require repo_name and issue_number; use issue_url for the normal GitHub issue flow",
        )
    state_input["incident_text"] = req.incident_text
    state_input["repo_name"] = req.repo_name
    state_input["issue_number"] = req.issue_number
    return state_input


@app.post("/incidents/run")
async def run_incident(req: IssueRequest):
    """Blocking run. Stops at approval unless auto_approve=true."""
    state_input = _state_input_from_issue_request(req)

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
    repo_name: str | None = None,
    issue_number: int | None = None,
    thread_id: str | None = None,
):
    """SSE stream of the full AUBI graph execution."""

    state_input = _state_input_from_issue_request(IssueRequest(
        issue_url=issue_url,
        incident_text=incident_text,
        repo_name=repo_name,
        issue_number=issue_number,
    ))
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
    snapshot = aubi_graph.get_state({"configurable": {"thread_id": thread_id}})
    if not snapshot.values:
        raise HTTPException(status_code=404, detail=f"No incident thread found for {thread_id}")
    if not snapshot.interrupts:
        raise HTTPException(status_code=409, detail=f"Incident thread {thread_id} is not awaiting approval")

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
    """Return the latest open issue on the configured target repo."""
    repo_name = _target_repo()
    if not repo_name:
        raise HTTPException(status_code=400, detail="Set TARGET_REPO or GITHUB_REPO to poll GitHub issues")
    try:
        from ingestion.github_issue import get_latest_open_issue
        return {"issue": get_latest_open_issue(repo_name)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GitHub issue poll failed: {e}") from e


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/ready")
async def ready():
    """Report whether the real demo dependencies are configured and reachable."""
    checks: dict[str, Any] = {
        "openai_api_key": bool(os.getenv("OPENAI_API_KEY")),
        "gemini_api_key": bool(os.getenv("GEMINI_API_KEY")),
        "github_token": bool(os.getenv("GITHUB_TOKEN")),
        "target_repo": bool(_target_repo()),
        "go_toolchain": bool(shutil.which("go")),
    }
    try:
        get_store()
        checks["qdrant"] = True
    except Exception as e:
        checks["qdrant"] = False
        checks["qdrant_error"] = str(e)

    required = [
        "openai_api_key",
        "gemini_api_key",
        "github_token",
        "go_toolchain",
        "qdrant",
    ]
    return {
        "ready": all(bool(checks.get(name)) for name in required),
        "checks": checks,
    }
