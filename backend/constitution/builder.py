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
from uuid import uuid4

import google.generativeai as genai

logger = logging.getLogger(__name__)

genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))
_gemini = genai.GenerativeModel(
    "gemini-2.0-flash",
    generation_config=genai.GenerationConfig(
        response_mime_type="application/json",
        temperature=0.2,
    ),
)

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


async def build_constitution_from_github(
    github_data: dict[str, Any],
) -> list[dict[str, Any]]:
    """Call GPT-5.5 to extract constitution facts from GitHub data.

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
    response = await _gemini.generate_content_async(full_prompt)
    raw = response.text
    try:
        start = raw.find("[")
        end = raw.rfind("]") + 1
        facts = json.loads(raw[start:end])
    except Exception as e:
        logger.error("Failed to parse constitution JSON: %s\nRaw: %s", e, raw[:500])
        facts = []

    # Ensure subject is set
    for f in facts:
        if not f.get("subject"):
            f["subject"] = username

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
        points.append(PointStruct(
            id=str(uuid4()),
            vector=vector,
            payload={
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
