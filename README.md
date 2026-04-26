<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:6366f1,100:8b5cf6&height=200&section=header&text=AUBI&fontSize=80&fontColor=ffffff&fontAlignY=38&desc=Autonomous%20Understanding%20%26%20Behaviour%20Inference&descAlignY=60&descSize=20&descColor=c4b5fd" width="100%"/>

<br/>

[![Python](https://img.shields.io/badge/Python-3.11-6366f1?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-8b5cf6?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![LangGraph](https://img.shields.io/badge/LangGraph-Orchestration-a78bfa?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-7c3aed?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Qdrant](https://img.shields.io/badge/Qdrant-Vector%20Store-6d28d9?style=for-the-badge&logo=qdrant&logoColor=white)](https://qdrant.tech)

<br/>

[![Gemini](https://img.shields.io/badge/Gemini%202.0%20Flash-Constitution%20Builder-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/gemini)
[![Claude](https://img.shields.io/badge/Claude%20Haiku-Agent%20Queries-D97706?style=for-the-badge&logo=anthropic&logoColor=white)](https://anthropic.com)
[![GPT](https://img.shields.io/badge/GPT--5.5-Fix%20Generator-10B981?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)

<br/>

> **"Not another auto-coder — a context-aware teammate network."**

**GDSC Hackathon 2026 · University of Maryland · April 26**

🏆 *Targeting: Best App for Developer Productivity · Most Creative · Best Use of Gemini*

<br/>

</div>

---

## What is AUBI?

AUBI is an **AI engineering coordinator** that learns every developer's ownership and tribal knowledge from GitHub.

When an issue drops, AUBI doesn't just write code — it figures out *which developer* owns the bug, *what that developer already knows* about it, and *how they prefer to collaborate*. It routes the issue to the right AI teammate, surfaces relevant context from team memory, proposes a verified fix, and opens a **human-approved** PR.

```
Copilot Workspace knows how to code.
OpenHands knows how to open PRs.
SWE-agent knows how to patch files.

None of them know which developer owns the bug,
or what that developer already knows about it.

That's AUBI's moat.
```

---

## The 90-Second Demo

**Scenario:** A professor files a GitHub issue — *"auth 401 blocking student submissions"*. She doesn't know who to ping. AUBI figures it out.

| Scene | What you see |
|---|---|
| **Meet the Team** | Dashboard: 3 developer cards. Click Alice → full Context Constitution — ownership, expertise, collaboration style, known issues. *Built with Gemini structured output.* |
| **Issue drops** | Prof files GitHub issue. Issue feed lights up. AUBI picks it up. |
| **Agents talk** | Live comm feed: Orchestrator pings Alice's Aubi. Alice surfaces the race condition from her constitution. Bob flags his adjacent PR. Lines pulse on the mesh. |
| **Why Alice?** | Routing panel: `auth/token.go → Alice Chen · owns auth/ (0.95) · known issue: race condition` |
| **Fix ready** | Code diff: Go mutex fix, syntax highlighted. `✓ Ownership matched · ✓ Memory found · ✓ Patch generated · ⏸ Awaiting approval` |
| **Human approves** | One click → real GitHub PR, written in Alice's style, Bob as reviewer, issue linked. |
| **AUBI learned** | `Memory updated: Alice known issue → resolved in PR #2 · Episode stored` |

---

## Architecture

```
                   GitHub Issue
                        │
              ┌─────────▼──────────┐
              │    AUBI Graph       │  LangGraph · 6 nodes
              │                     │
              │  issue_reader       │  Haiku: extract affected files
              │       ↓             │
              │  ownership_router   │  Qdrant: find agent owners
              │       ↓             │
              │  query_agents (║)   │  Haiku: parallel agent queries
              │       ↓             │
              │  code_reader        │  GitHub API: read live code
              │       ↓             │
              │  fix_generator      │  GPT-5.5: generate fix + diff
              │       ↓             │
              │  approval_gate  ⏸  │  LangGraph interrupt → frontend
              │       ↓ (on approve)│
              │  pr_pusher          │  GitHub API: push real PR
              └─────────┬──────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
 Alice's Aubi     Bob's Aubi      Carol's Aubi
 Haiku + const.   Haiku + const.  Haiku + const.
        │               │
        └───────────────┘
          Qdrant memory store
    (semantic_facts · episodes)

Constitution builder:  Gemini 2.0 Flash
SSE stream:            FastAPI → Next.js
GitHub API:            Issues · Code · PRs
```

---

## Models

| Role | Model | Why |
|---|---|---|
| **Constitution building** | Gemini 2.0 Flash | Structured output is first-class; prize alignment |
| **Orchestrator / Fix gen** | GPT-5.5 | Best code understanding for actual patch generation |
| **Agent constitution queries** | Claude Haiku | Fast, cheap, precise at reading constitution facts |
| **PR body writer** | Claude Haiku | Matches each developer's communication style |

---

## Repo Structure

```
GDSC-Hackathon/
├── backend/
│   ├── main.py                   FastAPI app — all endpoints
│   ├── requirements.txt
│   ├── .env.example
│   ├── seed_demo.py              Seeds Alice / Bob / Carol into Qdrant
│   ├── graphs/
│   │   ├── state.py              AUBIIssueState TypedDict
│   │   ├── incident_graph.py     6-node LangGraph graph
│   │   └── prompt_builder.py     Prompt assembly helpers
│   ├── ingestion/
│   │   ├── github_ingest.py      Developer profile ingestion
│   │   └── github_issue.py       read_issue · read_repo_files · create_fix_pr · poll
│   └── constitution/
│       ├── builder.py            GitHub → Gemini → structured facts
│       └── store.py              Qdrant read / write / search
└── frontend/
    └── aubi-web/                 Next.js 16 · Tailwind CSS 4 · shadcn/ui
        └── src/
            ├── app/
            │   ├── team/         Agent cards + constitution viewer
            │   └── demo/         Main demo view
            ├── hooks/
            │   └── useAUBIStream.ts   Central SSE hook
            └── components/aubi/
                ├── AgentCard.tsx
                ├── ConstitutionPanel.tsx
                ├── AgentMeshLines.tsx
                ├── AgentCommFeed.tsx
                ├── RoutingEvidencePanel.tsx
                ├── IssueFeed.tsx
                ├── CodeDiffPanel.tsx
                ├── ApprovalGate.tsx
                ├── PRPreviewPanel.tsx
                └── AUBILearnedStrip.tsx
```

---

## API

```
GET  /agents                     →  [{id, name, role, github_username, constitution_facts[]}]
GET  /agents/{id}                →  {id, name, constitution: {code_ownership, expertise, ...}}
POST /agents                     →  {github_username, name, role} → creates agent + constitution
POST /agents/{id}/query          →  {incident_text} → {context: str}

GET  /constitution/{id}          →  facts grouped by category
PATCH /constitution/{id}         →  {fact} → appends episode

GET  /ownership                  →  ?filepath=auth/ → {owner_agent_id, confidence}

POST /incidents/run              →  {issue_url} → {pr_url, patch_diff, fix_explanation}
GET  /incidents/stream           →  ?issue_url=...&thread_id=... → SSE stream
POST /incidents/approve          →  ?thread_id=... → resumes paused graph → {pr_url}

GET  /github/poll                →  {issue: {title, body, url, issue_number} | null}
GET  /health
```

### SSE Event Stream

```jsonc
{"event": "node_start",        "node": "issue_reader"}
{"event": "node_done",         "node": "issue_reader",     "data": {"affected_files": ["auth/token.go"]}}
{"event": "routing_evidence",  "data": {"agent_name": "Alice Chen", "matched_files": ["auth/token.go"], "evidence_facts": [...]}}
{"event": "agent_message",     "data": {"sender": "orchestrator", "recipient": "alice01_aubi", "message": "..."}}
{"event": "node_done",         "node": "fix_generator",    "data": {"patch_diff": "...", "fix_explanation": "..."}}
{"event": "awaiting_approval", "data": {"patch_diff": "..."}}
{"event": "node_done",         "node": "pr_pusher",        "data": {"pr_url": "https://github.com/..."}}
{"event": "aubi_learned",      "data": {"agent_name": "Alice Chen", "update": "race condition resolved in PR #2"}}
{"event": "complete",          "data": null}
```

---

## Quickstart

```bash
# 1. Spin up Qdrant
docker run -d -p 6333:6333 qdrant/qdrant

# 2. Backend
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in your keys
python seed_demo.py         # seed Alice / Bob / Carol
uvicorn main:app --port 8000 --reload

# 3. Frontend
cd frontend/aubi-web
npm install
npm run dev                 # localhost:3000
```

### Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...       # Claude Haiku
OPENAI_API_KEY=sk-...              # GPT-5.5
GEMINI_API_KEY=AIza...             # Gemini 2.0 Flash

GITHUB_TOKEN=ghp_...               # needs repo write access
DEMO_REPO=your-username/AUBI-Demo  # repo with planted bug

QDRANT_URL=http://localhost:6333
AGENTS_SERVICE_URL=http://localhost:8000
```

---

## Team

| | Person | Role | Deliverable |
|---|---|---|---|
| ⚡ | **Vitthal Agarwal** | Orchestration + Context Constitution | LangGraph graph · Gemini builder · Qdrant store · approval gate |
| 🔗 | **Neil** | GitHub Integration | Issue reader · code reader · PR pusher · demo repo |
| 🎨 | **Avhaang** | Frontend — Agents + Constitution | Agent cards · constitution viewer · comm feed · mesh lines |
| 🖥️ | **Mitansh** | Frontend — Demo Flow + SSE | Issue feed · code diff · Approve button · PR preview · SSE wiring |

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:8b5cf6,100:6366f1&height=120&section=footer" width="100%"/>

*Built at GDSC Hackathon 2026 · University of Maryland*

</div>
