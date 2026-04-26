"""Context Constitution builder.

Takes structured GitHub data → Gemini 2.0 Flash → list of ConstitutionFacts
→ stored as Qdrant semantic_facts points.

Gemini is used here for structured JSON output (response_mime_type=application/json).
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any
from uuid import NAMESPACE_URL, uuid5

try:
    import google.generativeai as genai
except ModuleNotFoundError:  # Keeps seeded demo flows alive before deps are installed.
    genai = None

logger = logging.getLogger(__name__)

ALLOWED_CATEGORIES = {
    "code_ownership",
    "expertise",
    "collaboration",
    "current_focus",
    "known_issues",
}

_gemini = None


def _get_gemini():
    global _gemini
    if _gemini is not None:
        return _gemini
    if genai is None:
        raise RuntimeError("google-generativeai is not installed")
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    genai.configure(api_key=api_key)
    _gemini = genai.GenerativeModel(
        os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.2,
        ),
    )
    return _gemini

CONSTITUTION_SYSTEM = """\
You are a developer profiling system. Analyze GitHub activity data and extract structured facts about a developer.

Return a JSON array of facts. Each fact MUST have these fields:
{
  "subject": "<github_username>",
  "predicate": "<verb describing relationship>",
  "object": "<the value>",
  "confidence": 0.0-1.0,
  "category": "<one of: code_ownership | expertise | collaboration | current_focus | known_issues>"
}

Guidelines:
- code_ownership: which directories/files they own (use predicate "owns")
- expertise: technical skills inferred from repos/languages (predicate "expertise_in")
- collaboration: how they prefer to work, review style, communication (predicate "prefers")
- current_focus: what they are actively working on right now (predicate "currently_working_on")
- known_issues: known problems in their code areas (predicate "is_aware_of_issue")

Be specific and concrete. Infer from patterns, not keywords.
Return ONLY valid JSON array. No markdown. No explanation.

Example output:
[
  {"subject": "alicechen", "predicate": "owns", "object": "auth/ directory (78% of commits there)", "confidence": 0.95, "category": "code_ownership"},
  {"subject": "alicechen", "predicate": "expertise_in", "object": "Go, PostgreSQL, distributed systems", "confidence": 0.9, "category": "expertise"},
  {"subject": "alicechen", "predicate": "prefers", "object": "async communication — review comments show she writes detailed, standalone explanations", "confidence": 0.8, "category": "collaboration"},
  {"subject": "alicechen", "predicate": "currently_working_on", "object": "payment retry logic based on recent PR titles", "confidence": 0.85, "category": "current_focus"}
]
"""

CONSTITUTION_USER = """\
Developer: {username} ({name})
Bio: {bio}
Company: {company}
Languages: {languages}

Top files/directories touched (last 90 days):
{top_files}

Recent commit messages (sample):
{commit_messages}

Recent PR titles:
{pr_titles}

Review comments written (sample):
{review_comments}

Extract 8-15 concrete facts about this developer.
"""


def _confidence(value: Any, default: float = 0.75) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return default


def _normalize_facts(raw_facts: Any, username: str) -> list[dict[str, Any]]:
    if not isinstance(raw_facts, list):
        return []

    facts: list[dict[str, Any]] = []
    for raw in raw_facts:
        if not isinstance(raw, dict):
            continue
        obj = str(raw.get("object", "")).strip()
        if not obj:
            continue
        category = str(raw.get("category", "expertise")).strip()
        if category not in ALLOWED_CATEGORIES:
            category = "expertise"
        facts.append({
            "subject": str(raw.get("subject") or username),
            "predicate": str(raw.get("predicate") or "knows"),
            "object": obj,
            "confidence": _confidence(raw.get("confidence")),
            "category": category,
        })
    return facts


def _fallback_constitution(github_data: dict[str, Any]) -> list[dict[str, Any]]:
    """Deterministic constitution builder for demos without Gemini configured."""
    username = github_data["username"]
    facts: list[dict[str, Any]] = []

    for path in github_data.get("top_files", [])[:4]:
        if not path:
            continue
        facts.append({
            "subject": username,
            "predicate": "owns",
            "object": f"{path} based on recent GitHub activity",
            "confidence": 0.72,
            "category": "code_ownership",
        })

    languages = github_data.get("languages", [])[:6]
    if languages:
        facts.append({
            "subject": username,
            "predicate": "expertise_in",
            "object": ", ".join(languages),
            "confidence": 0.78,
            "category": "expertise",
        })

    prs = github_data.get("prs", [])[:3]
    if prs:
        facts.append({
            "subject": username,
            "predicate": "currently_working_on",
            "object": "; ".join(pr.get("title", "") for pr in prs if pr.get("title")),
            "confidence": 0.7,
            "category": "current_focus",
        })

    reviews = github_data.get("review_comments_sample", [])[:2]
    if reviews:
        facts.append({
            "subject": username,
            "predicate": "prefers",
            "object": "detailed code review comments and async GitHub discussion",
            "confidence": 0.65,
            "category": "collaboration",
        })
    else:
        facts.append({
            "subject": username,
            "predicate": "prefers",
            "object": "GitHub-first async collaboration inferred from repository activity",
            "confidence": 0.55,
            "category": "collaboration",
        })

    if not facts:
        facts.append({
            "subject": username,
            "predicate": "expertise_in",
            "object": "general software engineering based on public GitHub profile",
            "confidence": 0.5,
            "category": "expertise",
        })

    return facts[:15]


async def build_constitution_from_github(
    github_data: dict[str, Any],
) -> list[dict[str, Any]]:
    """Call Gemini to extract constitution facts from GitHub data.

    Returns list of fact dicts ready to store in Qdrant.
    """
    username = github_data["username"]

    commit_messages = "\n".join(
        f"- {c['message']} ({c.get('repo', '?')})"
        for c in github_data.get("commits", [])[:30]
    )
    pr_titles = "\n".join(
        f"- {p['title']} ({p.get('repo', '?')})"
        for p in github_data.get("prs", [])[:15]
    )
    review_comments = "\n".join(
        f"- {r[:150]}" for r in github_data.get("review_comments_sample", [])
    )

    prompt = CONSTITUTION_USER.format(
        username=username,
        name=github_data.get("name", username),
        bio=github_data.get("bio", ""),
        company=github_data.get("company", ""),
        languages=", ".join(github_data.get("languages", [])),
        top_files="\n".join(f"  {f}" for f in github_data.get("top_files", [])[:20]),
        commit_messages=commit_messages or "(no commits found)",
        pr_titles=pr_titles or "(no PRs found)",
        review_comments=review_comments or "(no review comments found)",
    )

    full_prompt = f"{CONSTITUTION_SYSTEM}\n\n{prompt}"
    try:
        response = await _get_gemini().generate_content_async(full_prompt)
        raw = getattr(response, "text", "") or ""
        start = raw.find("[")
        end = raw.rfind("]") + 1
        facts = _normalize_facts(json.loads(raw[start:end]), username)
    except Exception as e:
        logger.warning("Gemini constitution build failed; using deterministic fallback: %s", e)
        facts = _fallback_constitution(github_data)

    return facts


def facts_to_qdrant_points(
    facts: list[dict[str, Any]],
    *,
    user_id: str,
    tenant_id: str,
    embed_fn,
) -> list[Any]:
    """Convert fact dicts into Qdrant PointStruct objects."""
    from qdrant_client.models import PointStruct

    points = []
    for fact in facts:
        text = f"{fact.get('subject', '')} {fact.get('predicate', '')} {fact.get('object', '')}"
        vector = embed_fn(text)
        point_key = json.dumps({
            "tenant_id": tenant_id,
            "user_id": user_id,
            "subject": fact.get("subject", ""),
            "predicate": fact.get("predicate", ""),
            "object": fact.get("object", ""),
            "category": fact.get("category", "general"),
        }, sort_keys=True, separators=(",", ":"), default=str)
        points.append(PointStruct(
            id=str(uuid5(NAMESPACE_URL, point_key)),
            vector=vector,
            payload={
                "user_id": user_id,
                "tenant_id": tenant_id,
                "scope": "user",
                "scope_id": user_id,
                "subject": fact.get("subject", ""),
                "predicate": fact.get("predicate", ""),
                "object": fact.get("object", ""),
                "confidence": fact.get("confidence", 0.7),
                "category": fact.get("category", "general"),
            },
        ))
    return points
