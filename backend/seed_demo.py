"""Seed demo agents and shared team memory into Qdrant for the AUBI hackathon demo.

Run once before the demo:
  cd backend && python seed_demo.py

Agents:
  alice  — auth/ and billing/ owner, knows about the race condition in token.go
  bob    — api/users/ and frontend/ owner, recently touched auth middleware
  carol  — infra/ and deploy/ owner

Shared team memory:
  Cross-agent resolution facts used by the coworker mesh before code is read.
"""

from __future__ import annotations

import os
import sys

# Allow running from backend/ dir
sys.path.insert(0, os.path.dirname(__file__))

from constitution.store import ConstitutionStore

TENANT = "hackathon"
TEAM_ID = "default"

DEMO_AGENTS = [
    {
        "id": "alice01",
        "github_username": "alicechen",
        "name": "Alice Chen",
        "role": "Senior Backend Engineer",
        "facts": [
            {"subject": "alicechen", "predicate": "owns", "object": "auth/ directory (82% of commits)", "confidence": 0.95, "category": "code_ownership"},
            {"subject": "alicechen", "predicate": "owns", "object": "billing/ directory (71% of commits)", "confidence": 0.9, "category": "code_ownership"},
            {"subject": "alicechen", "predicate": "expertise_in", "object": "Go, PostgreSQL, distributed systems, JWT auth", "confidence": 0.9, "category": "expertise"},
            {"subject": "alicechen", "predicate": "is_aware_of_issue", "object": "race condition in auth/token.go GetOrRefresh — no mutex on cache map", "confidence": 0.85, "category": "known_issues"},
            {"subject": "alicechen", "predicate": "currently_working_on", "object": "payment retry logic for billing service", "confidence": 0.8, "category": "current_focus"},
            {"subject": "alicechen", "predicate": "prefers", "object": "async Slack messages over direct pings — reviews done same-day", "confidence": 0.8, "category": "collaboration"},
            {"subject": "alicechen", "predicate": "prefers", "object": "detailed PR descriptions with context, not just what changed but why", "confidence": 0.75, "category": "collaboration"},
        ],
    },
    {
        "id": "bob02",
        "github_username": "bobpark",
        "name": "Bob Park",
        "role": "Full-Stack Engineer",
        "facts": [
            {"subject": "bobpark", "predicate": "owns", "object": "api/users/ directory (68% of commits)", "confidence": 0.9, "category": "code_ownership"},
            {"subject": "bobpark", "predicate": "owns", "object": "frontend/ directory (55% of commits)", "confidence": 0.85, "category": "code_ownership"},
            {"subject": "bobpark", "predicate": "expertise_in", "object": "TypeScript, React, REST API design, Go HTTP handlers", "confidence": 0.88, "category": "expertise"},
            {"subject": "bobpark", "predicate": "recently_changed", "object": "auth middleware in PR #44 — added token validation to /api/users/* routes", "confidence": 0.92, "category": "current_focus"},
            {"subject": "bobpark", "predicate": "currently_working_on", "object": "new user profile page and settings API", "confidence": 0.8, "category": "current_focus"},
            {"subject": "bobpark", "predicate": "prefers", "object": "quick Slack threads for small decisions, GitHub issues for larger design discussions", "confidence": 0.78, "category": "collaboration"},
            {"subject": "bobpark", "predicate": "is_aware_of_issue", "object": "auth token refresh occasionally returns 401 on high-concurrency endpoints — likely race condition upstream", "confidence": 0.7, "category": "known_issues"},
        ],
    },
    {
        "id": "carol03",
        "github_username": "carolzhang",
        "name": "Carol Zhang",
        "role": "Platform / Infrastructure Engineer",
        "facts": [
            {"subject": "carolzhang", "predicate": "owns", "object": "infra/ directory (90% of commits)", "confidence": 0.95, "category": "code_ownership"},
            {"subject": "carolzhang", "predicate": "owns", "object": "deploy/ directory (88% of commits)", "confidence": 0.93, "category": "code_ownership"},
            {"subject": "carolzhang", "predicate": "expertise_in", "object": "Kubernetes, Terraform, GitHub Actions CI/CD, GCP", "confidence": 0.92, "category": "expertise"},
            {"subject": "carolzhang", "predicate": "currently_working_on", "object": "migrating staging cluster to GKE Autopilot", "confidence": 0.85, "category": "current_focus"},
            {"subject": "carolzhang", "predicate": "prefers", "object": "infrastructure changes reviewed by at least two people before merging to main", "confidence": 0.88, "category": "collaboration"},
            {"subject": "carolzhang", "predicate": "prefers", "object": "concise bullet-point updates in Slack, not wall-of-text status reports", "confidence": 0.75, "category": "collaboration"},
        ],
    },
]

TEAM_MEMORY_FACTS = [
    {
        "subject": "team",
        "predicate": "knows_cross_agent_context",
        "object": (
            "Authentication 401 incidents in Neilyoo98/AUBI-demo can span auth/token.go cache refresh, "
            "API middleware token validation, and deployment timing. Owner AUBIs should ask adjacent coworkers "
            "for middleware, frontend submission, and deployment context before generating a fix."
        ),
        "confidence": 0.9,
        "category": "team_memory",
        "participants": ["alice01", "bob02", "carol03"],
        "repo_name": "Neilyoo98/AUBI-demo",
    },
    {
        "subject": "team",
        "predicate": "prefers_resolution_flow",
        "object": (
            "For production-blocking authentication issues, AUBI should route by code ownership, collect coworker "
            "context, verify with the repository test runner, pause at human approval, then write both personal "
            "agent episodes and shared team memory after PR creation."
        ),
        "confidence": 0.92,
        "category": "team_memory",
        "participants": ["alice01", "bob02", "carol03"],
        "repo_name": "Neilyoo98/AUBI-demo",
    },
]


def seed():
    print("Seeding demo agents into Qdrant...")
    store = ConstitutionStore()

    for agent in DEMO_AGENTS:
        store.delete_user(agent["id"], TENANT)
        count = store.upsert_facts(agent["id"], TENANT, agent["facts"])
        print(f"  ✓ {agent['name']} ({agent['id']}) — {count} facts stored")

    team_count = store.upsert_team_facts(TENANT, TEAM_MEMORY_FACTS, team_id=TEAM_ID, source_agent_id="seed_demo")
    print(f"  ✓ shared team memory ({TEAM_ID}) — {team_count} facts stored")

    print("\nDone. Pre-register agents in memory by calling POST /agents or use these IDs directly:")
    for agent in DEMO_AGENTS:
        print(f"  id={agent['id']}  username={agent['github_username']}  name={agent['name']}")


if __name__ == "__main__":
    seed()
