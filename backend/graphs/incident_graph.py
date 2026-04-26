"""AUBI Issue → PR Graph.

Full autonomous flow:
  GitHub issue → analyze → find owners → consult agents → read code → fix
  → verify → human approval → push PR

Models: GPT-5.5 for everything. Gemini 2.0 Flash used in constitution/builder.py only.
"""

from __future__ import annotations

import difflib
import json
import logging
import os
import re
import time
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, END
from langgraph.types import Send, interrupt
from dotenv import load_dotenv

from .state import AUBIIssueState, AgentMessage

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logger = logging.getLogger(__name__)
RELATED_FACT_CATEGORIES = {"code_ownership", "expertise", "current_focus", "known_issues", "collaboration"}

# ---------------------------------------------------------------------------
# Models — GPT-5.5 only. Gemini lives in constitution/builder.py.
# ---------------------------------------------------------------------------

_gpt55: ChatOpenAI | None = None


def _get_gpt55() -> ChatOpenAI:
    global _gpt55
    if _gpt55 is None:
        _gpt55 = ChatOpenAI(
            model=os.getenv("OPENAI_MODEL", "gpt-5.5"),
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("OPENAI_BASE_URL", "https://us.api.openai.com/v1"),
            streaming=False,
            use_responses_api=True,
        )
    return _gpt55


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_text(content: Any) -> str:
    """responses API returns a list of content blocks; extract plain text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(
            item.get("text", "") for item in content
            if isinstance(item, dict) and item.get("type") == "text"
        )
    return str(content)


def _json(content: Any) -> Any:
    text = _extract_text(content)
    start = text.find("{")
    end   = text.rfind("}") + 1
    if start >= 0 and end > start:
        return json.loads(text[start:end])
    start = text.find("[")
    end   = text.rfind("]") + 1
    if start >= 0 and end > start:
        return json.loads(text[start:end])
    return {}


def _flatten_constitution(grouped: dict[str, Any]) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    for value in grouped.values():
        if isinstance(value, list):
            facts.extend(fact for fact in value if isinstance(fact, dict))
    return facts


def _tenant_id() -> str:
    return os.getenv("AUBI_TENANT_ID", "hackathon")


def _team_id() -> str:
    return os.getenv("AUBI_TEAM_ID", "default")


def _issue_query(state: AUBIIssueState) -> str:
    return "\n".join([
        f"Issue: {state.get('issue_title', '')}",
        f"Body: {state.get('issue_body', '')}",
        f"Service: {state.get('affected_service', '')}",
        f"Error: {state.get('error_type', '')}",
        f"Files: {', '.join(state.get('affected_files') or [])}",
    ]).strip()


def _agent_name_from_facts(agent_id: str, facts: list[dict[str, Any]]) -> str:
    return str(next((fact.get("subject") for fact in facts if fact.get("subject")), agent_id))


def _compact_fact(fact: dict[str, Any], *, max_object_len: int = 220) -> dict[str, Any]:
    obj = str(fact.get("object", ""))
    compact = {
        "user_id": fact.get("user_id") or fact.get("scope_id"),
        "subject": fact.get("subject"),
        "predicate": fact.get("predicate"),
        "object": obj[:max_object_len],
        "category": fact.get("category"),
        "confidence": fact.get("confidence"),
    }
    if "_score" in fact:
        compact["_score"] = round(float(fact.get("_score") or 0.0), 3)
    if "_collection" in fact:
        compact["_collection"] = fact.get("_collection")
    for key in ("scope", "scope_id", "team_id", "participants", "issue_number", "pr_url"):
        if key in fact:
            compact[key] = fact[key]
    return compact


def _dedupe_facts(facts: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for fact in facts:
        key = json.dumps({
            "subject": fact.get("subject"),
            "predicate": fact.get("predicate"),
            "object": fact.get("object"),
            "category": fact.get("category"),
            "_collection": fact.get("_collection"),
        }, sort_keys=True, default=str)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(_compact_fact(fact))
        if len(deduped) >= limit:
            break
    return deduped


def _tokens(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-zA-Z0-9_./-]{3,}", text.lower())
        if token not in {"the", "and", "for", "with", "from", "this", "that", "issue"}
    }


def _file_signals(files: list[str]) -> set[str]:
    signals: set[str] = set()
    for path in files:
        lowered = path.lower()
        signals.add(lowered)
        if "/" in lowered:
            signals.add(lowered.split("/", 1)[0] + "/")
        signals.update(part for part in re.split(r"[/_.-]", lowered) if len(part) >= 3)
    return signals


def _select_related_coworkers(
    *,
    store: Any,
    state: AUBIIssueState,
    owner_ids: list[str],
    shared_hits: list[dict[str, Any]],
    limit: int = 3,
) -> list[dict[str, Any]]:
    query = _issue_query(state)
    files = state.get("affected_files") or []
    query_tokens = _tokens(query)
    file_signals = _file_signals(files)

    all_user_facts = store.list_user_facts(_tenant_id())
    semantic_hits = store.search_across_agent_facts(
        _tenant_id(),
        query,
        top_k=64,
        categories=RELATED_FACT_CATEGORIES,
    )

    candidates: dict[str, dict[str, Any]] = {}

    def add_candidate(agent_id: str, fact: dict[str, Any], score: float, signal: str) -> None:
        if not agent_id or agent_id in owner_ids:
            return
        facts = all_user_facts.get(agent_id, [])
        candidate = candidates.setdefault(agent_id, {
            "agent_id": agent_id,
            "agent_name": _agent_name_from_facts(agent_id, facts),
            "score": 0.0,
            "selection_signals": [],
            "matched_facts": [],
        })
        candidate["score"] += score
        if signal not in candidate["selection_signals"]:
            candidate["selection_signals"].append(signal)
        candidate["matched_facts"].append(fact)

    for hit in semantic_hits:
        agent_id = str(hit.get("user_id") or hit.get("scope_id") or "")
        category = str(hit.get("category") or "")
        score = float(hit.get("_score") or 0.0)
        signal = f"semantic_{category or 'fact'}"
        add_candidate(agent_id, hit, score, signal)

    for agent_id, facts in all_user_facts.items():
        if agent_id in owner_ids:
            continue
        for fact in facts:
            category = str(fact.get("category") or "")
            if category not in RELATED_FACT_CATEGORIES:
                continue
            obj = str(fact.get("object") or "").lower()
            obj_tokens = _tokens(obj)
            overlap = query_tokens & obj_tokens
            file_overlap = {signal for signal in file_signals if signal and signal in obj}
            if file_overlap:
                add_candidate(agent_id, fact, 1.25, f"{category}_file_overlap")
            elif overlap and category in {"expertise", "current_focus", "known_issues"}:
                add_candidate(agent_id, fact, min(0.9, 0.25 * len(overlap)), f"{category}_topic_overlap")

    for hit in shared_hits:
        participants = hit.get("participants") or hit.get("owner_ids") or []
        if isinstance(participants, str):
            participants = [participants]
        for participant in participants:
            agent_id = str(participant)
            if agent_id and agent_id not in owner_ids:
                add_candidate(agent_id, hit, 0.7, "shared_memory_overlap")

    selected = sorted(candidates.values(), key=lambda item: float(item["score"]), reverse=True)[:limit]
    for candidate in selected:
        candidate["score"] = round(float(candidate["score"]), 3)
        candidate["matched_facts"] = _dedupe_facts(candidate["matched_facts"], 5)
    return selected


# ---------------------------------------------------------------------------
# Node 1: issue_reader
# ---------------------------------------------------------------------------

async def issue_reader(state: AUBIIssueState) -> dict[str, Any]:
    """Read GitHub issue or use raw incident text. Extract affected files."""
    log = []
    repo_files: list[str] = []

    # If we have an issue URL, fetch from GitHub
    if state.get("issue_url"):
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
    else:
        body = state.get("incident_text", "")
        title = body[:80] if body else "Unknown"
        repo_name = state.get("repo_name")
        issue_number = state.get("issue_number")
        if not repo_name or not issue_number:
            raise ValueError("Raw incident runs require repo_name and issue_number so AUBI can read code and open a PR")
        issue_fields = {
            "repo_name": repo_name,
            "issue_number": issue_number,
            "issue_title": title,
            "issue_body": body,
        }
        log.append(f"📋 Incident: {title}")

    response = await _get_gpt55().ainvoke([
        SystemMessage(content=(
            "Extract from this issue report:\n"
            '{"affected_service": "...", "affected_files": ["path/to/file"], '
            '"error_type": "...", "urgency": "P1|P2|P3"}\n'
            "Return JSON only. affected_files must be real repository paths likely relevant to the bug."
        )),
        HumanMessage(content=f"Title: {title}\n\nBody:\n{body}"),
    ])
    data = _json(response.content)
    if not isinstance(data, dict) or not data.get("affected_files"):
        raise ValueError("Issue analysis did not identify any affected repository files")

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
    owner_ids: list[str] = []
    log: list[str] = []

    from constitution.store import ConstitutionStore
    store = ConstitutionStore()
    for filepath in (state.get("affected_files") or []):
        owner_id, confidence, _evidence = store.search_ownership(filepath, _tenant_id())
        if owner_id and owner_id not in owner_ids:
            owner_ids.append(owner_id)
            log.append(f"📍 {filepath} → agent {owner_id} ({confidence})")

    if not owner_ids:
        raise ValueError(f"No AUBI agent owner found for files: {state.get('affected_files') or []}")

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
    """Query one agent's constitution and return its context + agent messages + routing evidence."""
    agent_id = state.get("_query_agent_id", "")
    affected_files = state.get("affected_files") or []
    issue_summary = (
        f"Issue: {state.get('issue_title', '')}\n"
        f"Service: {state.get('affected_service')}, "
        f"Error: {state.get('error_type')}, "
        f"Files: {affected_files}"
    )

    orchestrator_msg: AgentMessage = {
        "sender": "orchestrator",
        "recipient": f"{agent_id}_aubi",
        "message": f"New issue: {state.get('issue_title', '')}. Is this in your domain?",
        "timestamp": time.time(),
    }

    from constitution.store import ConstitutionStore
    all_facts = _flatten_constitution(
        ConstitutionStore().get_by_user(agent_id, _tenant_id())
    )
    if not all_facts:
        raise RuntimeError(f"Agent {agent_id} has no constitution facts")
    agent_name = str(next((fact.get("subject") for fact in all_facts if fact.get("subject")), agent_id))

    constitution = json.dumps(all_facts[:20], indent=2)

    # Build routing evidence from facts that explain why this agent was chosen
    evidence_facts = []
    for fact in all_facts:
        obj  = fact.get("object", "")
        cat  = fact.get("category", "")
        if cat == "code_ownership" and any(
            f.split("/")[0] in obj or obj in f
            for f in affected_files
        ):
            evidence_facts.append(fact)
        elif cat == "known_issues":
            evidence_facts.append(fact)
        elif cat == "current_focus" and any(
            kw in obj.lower() for kw in ["auth", "token", "security", "retry"]
        ):
            evidence_facts.append(fact)

    response = await _get_gpt55().ainvoke([
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
    agent_reply = _extract_text(response.content)

    agent_msg: AgentMessage = {
        "sender": f"{agent_name}_aubi",
        "recipient": "orchestrator",
        "message": agent_reply,
        "timestamp": time.time(),
    }

    routing_evidence = {
        "agent_id":   agent_id,
        "agent_name": agent_name,
        "matched_files": [
            f for f in affected_files
            if any(f.split("/")[0] in ef.get("object", "") for ef in evidence_facts if ef.get("category") == "code_ownership")
        ] or affected_files,
        "evidence_facts": evidence_facts[:4],  # top 4 matching facts
    }

    return {
        "agent_messages": [orchestrator_msg, agent_msg],
        "agent_contexts": [{
            "agent_id": agent_id,
            "agent_name": agent_name,
            "context": agent_reply,
            "communication_pref": (
                next((f.get("object", "") for f in all_facts
                      if f.get("category") == "collaboration"), "")
            ),
        }],
        "routing_evidence": [routing_evidence],
        "stream_log": [f"🤖 {agent_name}: {agent_reply[:100]}..."],
    }


# ---------------------------------------------------------------------------
# Node 4: code_reader
# ---------------------------------------------------------------------------

async def code_reader(state: AUBIIssueState) -> dict[str, Any]:
    """Read affected files from the GitHub repo."""
    repo_name = state.get("repo_name")
    files     = state.get("affected_files") or []

    if not repo_name or not files:
        raise ValueError("Cannot read code without repo_name and affected_files")

    from ingestion.github_issue import read_repo_files
    contents = read_repo_files(repo_name, files)
    missing = [path for path in files if path not in contents]
    if missing:
        raise FileNotFoundError(f"Could not read required files from {repo_name}: {missing}")
    log = [f"📁 Read {len(contents)} file(s): {', '.join(contents.keys())}"]

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
    """Generate a code fix using GPT-5.5."""
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
        raise ValueError("Fix generation requires source file contents")

    prompt = (
        f"ISSUE:\n{issue_context}\n\n"
        f"DEVELOPER AGENT CONTEXT:\n{agent_context}\n\n"
        f"SOURCE FILES:\n{file_context}"
    )

    response = await _get_gpt55().ainvoke([
        SystemMessage(content=FIX_SYSTEM),
        HumanMessage(content=prompt),
    ])
    data = _json(response.content)
    if not isinstance(data, dict):
        raise ValueError("Fix generator did not return a JSON object")

    fixed_path = data.get("fixed_file_path")
    fixed_content = data.get("fixed_file_content")
    if not fixed_path or not fixed_content:
        raise ValueError("Fix generator did not return fixed_file_path and fixed_file_content")

    original = (state.get("file_contents") or {}).get(fixed_path)
    if original is None:
        raise ValueError(f"Fix generator returned unknown file path: {fixed_path}")

    if not data.get("patch_diff"):
        data["patch_diff"] = "".join(difflib.unified_diff(
            original.splitlines(keepends=True),
            fixed_content.splitlines(keepends=True),
            fromfile=f"a/{fixed_path}",
            tofile=f"b/{fixed_path}",
        ))

    return {
        "fixed_file_path":    data.get("fixed_file_path"),
        "fixed_file_content": data.get("fixed_file_content"),
        "patch_diff":         data.get("patch_diff", ""),
        "fix_explanation":    data.get("fix_explanation", ""),
        "stream_log": [f"🔧 Fix generated: {data.get('fix_explanation', '')[:100]}"],
    }


# ---------------------------------------------------------------------------
# Node 6: test_runner
# ---------------------------------------------------------------------------

async def test_runner(state: AUBIIssueState) -> dict[str, Any]:
    """Verify the generated file by applying it inside a real repo checkout."""
    import shutil
    import subprocess
    import tempfile
    from pathlib import Path

    repo_name = state.get("repo_name")
    fixed_path = state.get("fixed_file_path")
    fixed_content = state.get("fixed_file_content")
    token = os.getenv("GITHUB_TOKEN", "")

    def _sanitize(output: str) -> str:
        return output.replace(token, "[redacted]") if token else output

    if not fixed_path or not fixed_content:
        return {
            "tests_passed": False,
            "test_output": "No generated file to test.",
            "stream_log": ["🧪 Tests skipped — no generated file"],
        }

    if not repo_name:
        return {
            "tests_passed": False,
            "test_output": "No repo_name available for verification.",
            "stream_log": ["🧪 Verification failed — repo missing"],
        }

    if not fixed_path.endswith(".go"):
        return {
            "tests_passed": False,
            "test_output": f"No real test runner is configured for {fixed_path}. PR creation is blocked.",
            "stream_log": ["🧪 Verification failed — unsupported file type"],
        }

    if shutil.which("git") is None:
        return {
            "tests_passed": False,
            "test_output": "Git is unavailable. AUBI cannot clone the repository for verification.",
            "stream_log": ["🧪 Verification failed — git unavailable"],
        }

    if shutil.which("go") is None:
        output = "Go toolchain unavailable. Install Go so AUBI can run `go test ./...` before approval."
        return {
            "tests_passed": False,
            "test_output": output,
            "stream_log": ["🧪 go test ./... unavailable"],
        }

    with tempfile.TemporaryDirectory(prefix="aubi-test-") as tmp:
        root = Path(tmp) / "repo"
        clone_url = f"https://github.com/{repo_name}.git"
        if token:
            clone_url = f"https://x-access-token:{token}@github.com/{repo_name}.git"

        clone = subprocess.run(
            ["git", "clone", "--depth", "1", clone_url, str(root)],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=60,
            check=False,
        )
        if clone.returncode != 0:
            return {
                "tests_passed": False,
                "test_output": _sanitize(clone.stdout.strip() or "git clone failed"),
                "stream_log": ["🧪 Verification failed — clone failed"],
            }

        target = (root / fixed_path).resolve()
        if root.resolve() not in target.parents and target != root.resolve():
            return {
                "tests_passed": False,
                "test_output": f"Refusing to write outside repository checkout: {fixed_path}",
                "stream_log": ["🧪 Verification failed — invalid path"],
            }
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(fixed_content, encoding="utf-8")

        if not (root / "go.mod").exists():
            return {
                "tests_passed": False,
                "test_output": "Repository has no go.mod at its root; AUBI cannot run the intended Go verification.",
                "stream_log": ["🧪 Verification failed — go.mod missing"],
            }

        proc = subprocess.run(
            ["go", "test", "./..."],
            cwd=root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=120,
            check=False,
        )

    output = _sanitize(proc.stdout.strip() or ("PASS" if proc.returncode == 0 else "go test failed"))
    passed = proc.returncode == 0
    return {
        "tests_passed": passed,
        "test_output": output,
        "stream_log": [f"🧪 go test ./... {'PASS' if passed else 'FAIL'}"],
    }


# ---------------------------------------------------------------------------
# Node 7: approval_gate
# ---------------------------------------------------------------------------

async def approval_gate(state: AUBIIssueState) -> dict[str, Any]:
    """Pause execution until the frontend resumes the graph with approval."""
    decision = interrupt({
        "type": "approval_required",
        "patch_diff": state.get("patch_diff"),
        "fix_explanation": state.get("fix_explanation"),
        "fixed_file_path": state.get("fixed_file_path"),
        "tests_passed": state.get("tests_passed"),
        "test_output": state.get("test_output"),
    })

    approved = bool(decision.get("approved")) if isinstance(decision, dict) else bool(decision)
    return {
        "approval_status": approved,
        "stream_log": ["✅ Human approved PR push" if approved else "⛔ Human rejected PR push"],
    }


def route_after_approval(state: AUBIIssueState) -> str:
    return "approved" if state.get("approval_status") else "rejected"


# ---------------------------------------------------------------------------
# Node 8: pr_pusher
# ---------------------------------------------------------------------------

PR_BODY_SYSTEM = """\
Write a GitHub PR description. The PR body should follow {agent_name}'s preferred communication style.

Preferred style: {comm_style}

Fill this template exactly:
## What changed
{fix_explanation}

## Why
Fixes #{issue_number}: {issue_title}

## Testing
- [x] go test ./... passes
- [x] AUBI approval gate reviewed before PR creation

Closes #{issue_number}

Note: PR body follows {agent_name}'s preferred communication style.
Keep it concise. Do not impersonate the developer — write as their AI representative.
"""

async def pr_pusher(state: AUBIIssueState) -> dict[str, Any]:
    """Push the fix as a branch and open a PR on GitHub."""
    repo_name    = state.get("repo_name")
    issue_number = state.get("issue_number")
    fixed_path   = state.get("fixed_file_path")
    fixed_content = state.get("fixed_file_content")

    if not all([repo_name, issue_number, fixed_path, fixed_content]):
        raise ValueError("PR push requires repo_name, issue_number, fixed_file_path, and fixed_file_content")

    if state.get("tests_passed") is not True:
        raise RuntimeError(f"Refusing to push PR because tests did not pass: {state.get('test_output')}")

    # Generate PR body in owner's style
    contexts  = state.get("agent_contexts") or []
    primary   = contexts[0] if contexts else {}
    comm_style = primary.get("communication_pref", "professional and direct")

    agent_name = primary.get("agent_name", "the code owner")
    pr_body_response = await _get_gpt55().ainvoke([
        SystemMessage(content=PR_BODY_SYSTEM.format(
            agent_name=agent_name,
            comm_style=comm_style,
            fix_explanation=state.get("fix_explanation", ""),
            issue_number=issue_number,
            issue_title=state.get("issue_title", ""),
        )),
    ])
    pr_body = _extract_text(pr_body_response.content)
    if not pr_body.strip():
        raise ValueError("PR body generation returned empty text")

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

    learned_facts: list[dict] = []
    if pr_url:
        # Self-learning: store episode in Qdrant for each involved agent.
        from constitution.store import ConstitutionStore
        store = ConstitutionStore()
        for ctx in (state.get("agent_contexts") or []):
            agent_id   = ctx.get("agent_id", "")
            agent_name_ctx = ctx.get("agent_name", agent_id)
            if not agent_id:
                continue
            episode = {
                "subject":    agent_id,
                "predicate":  "resolved_issue",
                "object":     f"Issue #{issue_number}: {state.get('issue_title', '')} — fixed with {state.get('fix_explanation', '')[:80]}",
                "category":   "episodes",
                "confidence": 0.9,
            }
            store.add_episode(agent_id, "hackathon", episode)
            learned_facts.append({
                "agent_id":   agent_id,
                "agent_name": agent_name_ctx,
                "update":     f"Issue #{issue_number} resolved — {state.get('fix_explanation', '')[:80]}",
                "episode":    episode["object"],
            })

    return {
        "pr_url":       pr_url,
        "learned_facts": learned_facts,
        "stream_log":   log,
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
    builder.add_node("test_runner",        test_runner)
    builder.add_node("approval_gate",      approval_gate)
    builder.add_node("pr_pusher",          pr_pusher)

    builder.set_entry_point("issue_reader")
    builder.add_edge("issue_reader",     "ownership_router")

    # Fan-out to parallel agent queries
    builder.add_conditional_edges("ownership_router", route_to_agents, ["query_single_agent"])

    # After all agent queries complete, move to code_reader
    builder.add_edge("query_single_agent", "code_reader")
    builder.add_edge("code_reader",        "fix_generator")
    builder.add_edge("fix_generator",      "test_runner")
    builder.add_edge("test_runner",        "approval_gate")
    builder.add_conditional_edges(
        "approval_gate",
        route_after_approval,
        {"approved": "pr_pusher", "rejected": END},
    )
    builder.add_edge("pr_pusher",          END)

    return builder.compile(checkpointer=MemorySaver())


aubi_graph = build_aubi_graph()
