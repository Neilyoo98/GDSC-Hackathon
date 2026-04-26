"""AUBI Issue → PR Graph (6 nodes).

Full autonomous flow:
  GitHub issue → analyze → find owners → consult agents → read code → fix → push PR

Models:
  Orchestrator nodes: Claude Sonnet (analysis, fix gen, PR body)
  Agent queries:      Claude Haiku  (fast per-agent constitution look-up)
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.types import Send

from .state import AUBIIssueState, AgentMessage

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

sonnet = ChatAnthropic(model="claude-sonnet-4-5-20251001")
haiku  = ChatAnthropic(model="claude-haiku-20240307")

AGENTS_URL  = os.getenv("AGENTS_SERVICE_URL",    "http://localhost:8000")
KNOWLEDGE_URL = os.getenv("KNOWLEDGE_SERVICE_URL", "http://localhost:8002")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _json(text: str) -> Any:
    start = text.find("{")
    end   = text.rfind("}") + 1
    if start >= 0 and end > start:
        return json.loads(text[start:end])
    start = text.find("[")
    end   = text.rfind("]") + 1
    if start >= 0 and end > start:
        return json.loads(text[start:end])
    return {}


# ---------------------------------------------------------------------------
# Node 1: issue_reader
# ---------------------------------------------------------------------------

async def issue_reader(state: AUBIIssueState) -> dict[str, Any]:
    """Read GitHub issue or use raw incident text. Extract affected files."""
    import httpx

    log = []

    # If we have an issue URL, fetch from GitHub
    if state.get("issue_url"):
        try:
            from ingestion.github_issue import read_issue
            issue_data = read_issue(state["issue_url"])
            title = issue_data["title"]
            body  = issue_data["body"]
            log.append(f"📋 Issue #{issue_data['issue_number']}: {title}")
            issue_fields = {
                "repo_name":    issue_data["repo_name"],
                "issue_number": issue_data["issue_number"],
                "issue_title":  title,
                "issue_body":   body,
                "issue_author": issue_data["author"],
            }
        except Exception as e:
            logger.error("issue_reader: failed to fetch issue: %s", e)
            issue_fields = {}
            body = state.get("incident_text", "")
            title = "Unknown issue"
    else:
        body = state.get("incident_text", "")
        title = body[:80] if body else "Unknown"
        issue_fields = {"issue_title": title, "issue_body": body}
        log.append(f"📋 Incident: {title}")

    # Claude Haiku: extract affected files/service from issue body
    response = await haiku.ainvoke([
        SystemMessage(content=(
            "Extract from this issue report:\n"
            '{"affected_service": "...", "affected_files": ["path/to/file"], '
            '"error_type": "...", "urgency": "P1|P2|P3"}\n'
            "Return JSON only."
        )),
        HumanMessage(content=f"Title: {title}\n\n{body}"),
    ])
    data = _json(response.content)

    log.append(
        f"🔍 Identified: {data.get('affected_service','?')} — "
        f"{data.get('error_type','?')} ({data.get('urgency','P2')})"
    )

    return {
        **issue_fields,
        "affected_files":   data.get("affected_files", []),
        "affected_service": data.get("affected_service"),
        "error_type":       data.get("error_type"),
        "urgency":          data.get("urgency", "P2"),
        "stream_log":       log,
    }


# ---------------------------------------------------------------------------
# Node 2: ownership_router
# ---------------------------------------------------------------------------

async def ownership_router(state: AUBIIssueState) -> dict[str, Any]:
    """Find which agents own the affected files via the constitution store."""
    import httpx

    owner_ids: list[str] = []
    log: list[str] = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        for filepath in (state.get("affected_files") or []):
            try:
                resp = await client.get(f"{AGENTS_URL}/ownership", params={"filepath": filepath})
                if resp.status_code == 200:
                    data = resp.json()
                    if oid := data.get("owner_agent_id"):
                        if oid not in owner_ids:
                            owner_ids.append(oid)
                            log.append(f"📍 {filepath} → agent {oid}")
            except Exception:
                pass

    # Fallback: use first registered agent
    if not owner_ids:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{AGENTS_URL}/agents")
                if resp.status_code == 200 and resp.json():
                    owner_ids = [resp.json()[0]["id"]]
                    log.append(f"📍 Fallback: using first agent {owner_ids[0]}")
        except Exception:
            pass

    return {"owner_ids": owner_ids, "stream_log": log}


# ---------------------------------------------------------------------------
# Node 3: agent_consultor (fan-out via Send API)
# ---------------------------------------------------------------------------

def route_to_agents(state: AUBIIssueState):
    """Fan out to one query node per owner."""
    return [
        Send("query_single_agent", {**state, "_query_agent_id": agent_id})
        for agent_id in (state.get("owner_ids") or [])
    ]


async def query_single_agent(state: AUBIIssueState) -> dict[str, Any]:
    """Query one agent's constitution and return its context + agent messages."""
    import httpx

    agent_id = state.get("_query_agent_id", "")
    issue_summary = (
        f"Issue: {state.get('issue_title', '')}\n"
        f"Service: {state.get('affected_service')}, "
        f"Error: {state.get('error_type')}, "
        f"Files: {state.get('affected_files')}"
    )

    orchestrator_msg: AgentMessage = {
        "sender": "orchestrator",
        "recipient": f"{agent_id}_aubi",
        "message": f"New issue: {state.get('issue_title', '')}. Is this in your domain?",
        "timestamp": time.time(),
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{AGENTS_URL}/agents/{agent_id}")
            if resp.status_code != 200:
                return {"agent_messages": [orchestrator_msg], "agent_contexts": [], "stream_log": []}

            agent_data = resp.json()
            agent_name = agent_data.get("name", agent_id)
            constitution = json.dumps(agent_data.get("constitution_facts", [])[:20], indent=2)

            response = await haiku.ainvoke([
                SystemMessage(content=(
                    f"You are {agent_name}'s Aubi (AI representative).\n"
                    f"Their constitution:\n{constitution}\n\n"
                    "Answer briefly in 2-3 sentences:\n"
                    "1. Is this issue in their domain?\n"
                    "2. What context do they have?\n"
                    "3. What should be checked first?"
                )),
                HumanMessage(content=issue_summary),
            ])
            agent_reply = response.content

    except Exception as e:
        agent_reply = f"(Could not query agent: {e})"
        agent_name = agent_id

    agent_msg: AgentMessage = {
        "sender": f"{agent_name}_aubi",
        "recipient": "orchestrator",
        "message": agent_reply,
        "timestamp": time.time(),
    }

    return {
        "agent_messages": [orchestrator_msg, agent_msg],
        "agent_contexts": [{
            "agent_id": agent_id,
            "agent_name": agent_name,
            "context": agent_reply,
            "communication_pref": agent_data.get("constitution", {})
                .get("collaboration", {}).get("communication_pref", "")
                if "agent_data" in dir() else "",
        }],
        "stream_log": [f"🤖 {agent_name}: {agent_reply[:100]}..."],
    }


# ---------------------------------------------------------------------------
# Node 4: code_reader
# ---------------------------------------------------------------------------

async def code_reader(state: AUBIIssueState) -> dict[str, Any]:
    """Read affected files from the GitHub repo."""
    repo_name = state.get("repo_name") or os.getenv("DEMO_REPO", "")
    files     = state.get("affected_files") or []

    if not repo_name or not files:
        return {"file_contents": {}, "stream_log": ["📁 No repo/files to read"]}

    try:
        from ingestion.github_issue import read_repo_files
        contents = read_repo_files(repo_name, files)
        log = [f"📁 Read {len(contents)} file(s): {', '.join(contents.keys())}"]
    except Exception as e:
        logger.error("code_reader error: %s", e)
        contents = {}
        log = [f"📁 Could not read files: {e}"]

    return {"file_contents": contents, "stream_log": log}


# ---------------------------------------------------------------------------
# Node 5: fix_generator
# ---------------------------------------------------------------------------

FIX_SYSTEM = """\
You are an expert software engineer fixing a bug.

You will receive:
1. A GitHub issue description
2. The relevant source files
3. Context from the developer agents who own this code

Your task:
- Identify the exact bug
- Generate the complete fixed version of the most relevant file
- Write a brief fix explanation (2-3 sentences)

Return JSON:
{
  "fixed_file_path": "path/to/file.go",
  "fixed_file_content": "<complete fixed file content>",
  "patch_diff": "<unified diff showing just the changed lines>",
  "fix_explanation": "Brief explanation of what was wrong and what was fixed."
}

Return valid JSON only. The fixed_file_content must be the COMPLETE file, not just the diff.
"""

async def fix_generator(state: AUBIIssueState) -> dict[str, Any]:
    """Generate a code fix using Claude Sonnet."""
    issue_context = (
        f"Issue #{state.get('issue_number')}: {state.get('issue_title')}\n"
        f"{state.get('issue_body', '')}\n\n"
        f"Service: {state.get('affected_service')}\n"
        f"Error type: {state.get('error_type')}"
    )

    agent_context = "\n\n".join(
        f"[{ctx['agent_name']}]: {ctx['context']}"
        for ctx in (state.get("agent_contexts") or [])
    )

    file_context = "\n\n".join(
        f"=== {path} ===\n{content}"
        for path, content in (state.get("file_contents") or {}).items()
    )

    if not file_context:
        # No files available — generate conceptual fix
        file_context = "(Source files could not be fetched — generate fix based on issue + agent context)"

    prompt = (
        f"ISSUE:\n{issue_context}\n\n"
        f"DEVELOPER AGENT CONTEXT:\n{agent_context}\n\n"
        f"SOURCE FILES:\n{file_context}"
    )

    response = await sonnet.ainvoke([
        SystemMessage(content=FIX_SYSTEM),
        HumanMessage(content=prompt),
    ])

    data = _json(response.content)

    return {
        "fixed_file_path":    data.get("fixed_file_path"),
        "fixed_file_content": data.get("fixed_file_content"),
        "patch_diff":         data.get("patch_diff", ""),
        "fix_explanation":    data.get("fix_explanation", ""),
        "stream_log": [f"🔧 Fix generated: {data.get('fix_explanation', '')[:100]}"],
    }


# ---------------------------------------------------------------------------
# Node 6: pr_pusher
# ---------------------------------------------------------------------------

PR_BODY_SYSTEM = """\
Write a GitHub PR description in the communication style of the developer below.

Style: {comm_style}

Fill this template:
## What changed
{fix_explanation}

## Why
Fixes #{issue_number}: {issue_title}

## Testing
- [ ] Unit tests pass
- [ ] Manually verified fix resolves the 401 errors

Closes #{issue_number}

Keep it concise and match the developer's writing style exactly.
"""

async def pr_pusher(state: AUBIIssueState) -> dict[str, Any]:
    """Push the fix as a branch and open a PR on GitHub."""
    repo_name    = state.get("repo_name") or os.getenv("DEMO_REPO", "")
    issue_number = state.get("issue_number")
    fixed_path   = state.get("fixed_file_path")
    fixed_content = state.get("fixed_file_content")

    if not all([repo_name, issue_number, fixed_path, fixed_content]):
        return {
            "pr_url": None,
            "stream_log": ["⚠️ PR push skipped — missing repo, issue number, or fix"],
        }

    # Generate PR body in owner's style
    contexts  = state.get("agent_contexts") or []
    primary   = contexts[0] if contexts else {}
    comm_style = primary.get("communication_pref", "professional and direct")

    pr_body_response = await haiku.ainvoke([
        SystemMessage(content=PR_BODY_SYSTEM.format(
            comm_style=comm_style,
            fix_explanation=state.get("fix_explanation", ""),
            issue_number=issue_number,
            issue_title=state.get("issue_title", ""),
        )),
    ])
    pr_body = pr_body_response.content

    try:
        from ingestion.github_issue import create_fix_pr
        pr_url = create_fix_pr(
            repo_name=repo_name,
            issue_number=issue_number,
            issue_title=state.get("issue_title", "fix"),
            file_path=fixed_path,
            new_file_content=fixed_content,
            pr_body=pr_body,
        )
        log = [f"🚀 PR pushed: {pr_url}"]
    except Exception as e:
        logger.error("pr_pusher error: %s", e)
        pr_url = None
        log = [f"⚠️ PR push failed: {e}"]

    # Update agent constitutions (self-learning)
    import httpx
    for ctx in (state.get("agent_contexts") or []):
        agent_id = ctx.get("agent_id")
        if agent_id:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.patch(f"{AGENTS_URL}/constitution/{agent_id}", json={
                        "fact": {
                            "subject": agent_id,
                            "predicate": "resolved_issue",
                            "object": f"Issue #{issue_number}: {state.get('issue_title', '')}",
                            "category": "episodes",
                            "confidence": 0.9,
                        }
                    })
            except Exception:
                pass

    return {
        "pr_url": pr_url,
        "stream_log": log,
    }


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------

def build_aubi_graph() -> Any:
    builder = StateGraph(AUBIIssueState)

    builder.add_node("issue_reader",       issue_reader)
    builder.add_node("ownership_router",   ownership_router)
    builder.add_node("query_single_agent", query_single_agent)
    builder.add_node("code_reader",        code_reader)
    builder.add_node("fix_generator",      fix_generator)
    builder.add_node("pr_pusher",          pr_pusher)

    builder.set_entry_point("issue_reader")
    builder.add_edge("issue_reader",     "ownership_router")

    # Fan-out to parallel agent queries
    builder.add_conditional_edges("ownership_router", route_to_agents, ["query_single_agent"])

    # After all agent queries complete, move to code_reader
    builder.add_edge("query_single_agent", "code_reader")
    builder.add_edge("code_reader",        "fix_generator")
    builder.add_edge("fix_generator",      "pr_pusher")
    builder.add_edge("pr_pusher",          END)

    return builder.compile()


aubi_graph = build_aubi_graph()
