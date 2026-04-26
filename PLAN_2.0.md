# AUBI 2.0 — Autonomous Understanding & Behaviour Inference
### GDSC Hackathon 2026 · UMD · April 26

**Target prizes:** Best App for Developer Productivity · Best Use of Gemini (demo uses Claude/Anthropic — still qualifies for dev productivity + creativity prizes)

> **Stack change from Plan 1.0:** Dropped Gemini API (no credits). Using **LangGraph** for multi-agent orchestration + **Claude (Anthropic)** as the LLM backbone. Embeddings via `sentence-transformers` (free, runs locally). Vector store via **ChromaDB** (free, local). Zero paid API dependencies beyond one Anthropic key.

---

## Why LangGraph over raw Anthropic SDK

| | Raw Anthropic SDK | LangGraph + Claude |
|---|---|---|
| Multi-agent routing | Manual, roll your own | Built-in supervisor + subgraph patterns |
| State persistence | Manual | Built-in checkpointers (SQLite/Firestore) |
| Conditional logic | If/else spaghetti | Graph edges with conditional routing |
| Streaming to frontend | Manual SSE | Built-in `.astream_events()` |
| Retry / error handling | Manual | Built-in node-level retries |
| Demo visualization | Nothing | Can visualize the graph live |

LangGraph is literally designed for exactly what AUBI is: a stateful, multi-agent, conditionally-routed system. Claude powers the intelligence inside each node.

---

## Architecture

```
                        ┌──────────────────────────────┐
                        │      AUBI LangGraph           │
                        │                               │
    Incident Text ──────►  incident_analyzer            │
                        │         │                     │
                        │         ▼                     │
                        │  ownership_router             │
                        │    (git blame + ChromaDB)     │
                        │         │                     │
                        │    ┌────┴────┐                │
                        │    ▼         ▼                │
                        │ agent_A   agent_B  ...        │
                        │ querier   querier             │
                        │    └────┬────┘                │
                        │         ▼                     │
                        │  response_drafter             │
                        │  (Claude Sonnet)              │
                        │         │                     │
                        │         ▼                     │
                        │  memory_updater               │
                        │  (patches constitutions)      │
                        └──────────────────────────────┘
                                  │
                    ┌─────────────┴──────────────┐
                    │     Shared State Store       │
                    │  ChromaDB  (vector memory)   │
                    │  Firestore (constitutions)   │
                    └─────────────────────────────┘
```

### LangGraph State Definition

```python
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END

class AUBIState(TypedDict):
    incident_text: str           # raw Slack thread / error paste
    affected_files: list[str]    # extracted from incident
    owners: list[str]            # agent IDs to involve
    agent_contexts: dict         # {agent_id: relevant constitution excerpt}
    drafted_response: str        # Slack message to send
    postmortem: str              # markdown postmortem skeleton
    memory_updates: dict         # {agent_id: memory block patches}
    stream_log: list[str]        # for real-time frontend display
```

### Agent Nodes (each powered by Claude)

```
incident_analyzer  →  "What service, what error, what's the blast radius?"
ownership_router   →  "Given these files/services, which agents to involve?"
agent_querier(N)   →  "Alice's constitution says X. What context does she have on this?"
response_drafter   →  "Draft Slack msg in Alice's communication style + postmortem"
memory_updater     →  "What should each agent learn from this incident?"
```

---

## Context Constitution (per agent, stored in Firestore)

Built by **Claude Sonnet** from GitHub data. Updated by `memory_updater` after incidents.

```json
{
  "persona": {
    "name": "Alice Chen",
    "role": "Senior Backend Engineer",
    "team": "Payments",
    "expertise": ["Go", "PostgreSQL", "Kafka", "distributed systems"],
    "github_handle": "alicechen"
  },
  "work": {
    "code_ownership": ["auth/", "billing/", "api/gateway/"],
    "current_focus": "Refactoring retry logic in payment pipeline",
    "known_issues": ["auth token race condition on mobile (unresolved)"],
    "upcoming": "Q3 payment gateway migration"
  },
  "collaboration": {
    "communication_pref": "async, detailed — needs specifics before asking",
    "review_style": "thorough, prefers small PRs, leaves inline comments",
    "availability": "9am–6pm EST, P1 only after hours",
    "how_to_engage": "lead with error + stack trace, not open questions",
    "dont": ["interrupt for non-P1 after 5pm", "ask root cause without providing data"]
  },
  "team": {
    "shared_context": "Team mid-migration from monolith to microservices",
    "shared_pain_points": ["Flaky tests in CI blocking releases"]
  },
  "memory_version": 3,
  "last_updated": "2026-04-26T11:32:00Z"
}
```

Memory blocks evolve. Version 1 = raw GitHub inference. Version N = learned from N incidents.

---

## Demo Flow (what judges see — ~15 seconds)

1. **Three agent cards** on screen. Click any card to see their full constitution: code ownership, collaboration style, current focus. Built automatically from GitHub.

2. **Paste incident** into console:
   > `"prod is down, payment service throwing 500s, started ~20min ago, no idea why"`

3. **Watch the LangGraph stream** in real-time on screen (agent activity feed):
   - `incident_analyzer` → "Payment service, 500 errors, ~20min ago. Checking ownership..."
   - `ownership_router` → "billing/, api/gateway/ → Alice. auth/ → Bob (secondary)."
   - `agent_querier[Alice]` → "Alice has context: tracking retry logic bug. Known issue matches."
   - `response_drafter` → "Drafting Slack in Alice's style..."

4. **Output panel** shows:
   - ✅ Slack message (in Alice's tone, with specific steps)
   - ✅ Postmortem skeleton (timeline, owner, action items prefilled)
   - ✅ "Alice's constitution updated: retry logic issue marked as resolved"

---

## Tech Stack

| Component | Technology | Cost |
|---|---|---|
| Multi-agent orchestration | **LangGraph** (`langgraph>=0.2`) | Free |
| LLM (constitution building) | **Claude 3.5 Sonnet** (`langchain-anthropic`) | Anthropic key |
| LLM (fast agent queries) | **Claude 3 Haiku** | Anthropic key |
| Embeddings | **sentence-transformers** (`all-MiniLM-L6-v2`) | Free, runs local |
| Vector store | **ChromaDB** (local) | Free |
| Agent state / constitutions | **Firebase Firestore** | Free tier |
| GitHub data | **PyGitHub** | Free |
| Backend | **FastAPI** + **uvicorn** | Free |
| Frontend | **React + Vite + Tailwind** | Free |
| Streaming | LangGraph `.astream_events()` → SSE | Free |
| Deployment | **Railway / Render** (faster than Cloud Run setup) | Free tier |

**Only API key needed: `ANTHROPIC_API_KEY`**

---

## Project Structure

```
AUBI/
├── backend/
│   ├── main.py                 # FastAPI app + SSE endpoints
│   ├── graph/
│   │   ├── aubi_graph.py       # LangGraph StateGraph definition
│   │   ├── nodes/
│   │   │   ├── incident_analyzer.py
│   │   │   ├── ownership_router.py
│   │   │   ├── agent_querier.py
│   │   │   ├── response_drafter.py
│   │   │   └── memory_updater.py
│   │   └── state.py            # AUBIState TypedDict
│   ├── agents/
│   │   ├── constitution_builder.py   # GitHub → Claude → JSON
│   │   ├── memory_store.py           # Firestore read/write
│   │   └── vector_memory.py          # ChromaDB semantic search
│   ├── integrations/
│   │   ├── github_ingest.py          # Pull commits, PRs, file ownership
│   │   └── ownership_map.py          # git log → file → owner
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── components/
    │   │   ├── AgentCard.tsx          # Dev profile card
    │   │   ├── IncidentConsole.tsx    # Paste + trigger
    │   │   ├── AgentActivityFeed.tsx  # Real-time LangGraph stream
    │   │   └── ResponsePanel.tsx      # Slack msg + postmortem
    │   └── api/
    │       └── client.ts              # SSE + REST calls
    └── package.json
```

---

## Team Division of Work

### Person 1 — LangGraph Graph + Agent Nodes
**You own:** `backend/graph/`

**Goal:** Wire the full LangGraph pipeline. Each node calls Claude with the right prompt and the right slice of state.

**Tasks:**
- [ ] `pip install langgraph langchain-anthropic langchain-core`
- [ ] Define `AUBIState` in `state.py`
- [ ] Implement `incident_analyzer` node — Claude Sonnet prompt: extract service, error type, affected areas from raw incident text
- [ ] Implement `ownership_router` node — given affected areas, query ChromaDB + git ownership map, return list of agent IDs to involve
- [ ] Implement `agent_querier` node — for each relevant agent, load their constitution from Firestore, ask Claude Haiku: "given this constitution, what context is relevant to this incident?"
- [ ] Implement `response_drafter` node — Claude Sonnet: draft Slack message in the primary owner's communication style, generate postmortem markdown
- [ ] Implement `memory_updater` node — Claude Haiku: for each involved agent, what should be updated in their work/collaboration blocks?
- [ ] Wire all nodes into `StateGraph`, define edges + conditional routing
- [ ] Expose `graph.astream_events()` for streaming

**Key code skeleton:**
```python
from langgraph.graph import StateGraph, END
from langchain_anthropic import ChatAnthropic

sonnet = ChatAnthropic(model="claude-3-5-sonnet-20241022")
haiku  = ChatAnthropic(model="claude-3-haiku-20240307")

def incident_analyzer(state: AUBIState) -> AUBIState:
    # Claude extracts: service, error type, files/services affected
    ...

def ownership_router(state: AUBIState) -> AUBIState:
    # Query ChromaDB + ownership map → populate state["owners"]
    ...

builder = StateGraph(AUBIState)
builder.add_node("incident_analyzer", incident_analyzer)
builder.add_node("ownership_router", ownership_router)
builder.add_node("agent_querier", agent_querier)
builder.add_node("response_drafter", response_drafter)
builder.add_node("memory_updater", memory_updater)

builder.set_entry_point("incident_analyzer")
builder.add_edge("incident_analyzer", "ownership_router")
builder.add_edge("ownership_router", "agent_querier")
builder.add_edge("agent_querier", "response_drafter")
builder.add_edge("response_drafter", "memory_updater")
builder.add_edge("memory_updater", END)

graph = builder.compile()
```

**Deliverable:** `graph.ainvoke({"incident_text": "..."})` returns full `AUBIState` with response + postmortem.

---

### Person 2 — FastAPI Backend + Streaming + Constitution Builder
**You own:** `backend/main.py` + `backend/agents/constitution_builder.py`

**Goal:** HTTP layer + the thing that creates agent constitutions from GitHub data.

**Tasks:**
- [ ] FastAPI app with these endpoints:
  ```
  GET  /agents                    → list all agents + constitutions
  GET  /agents/{id}               → single agent's constitution
  POST /agents/build              → body: {github_username} → builds constitution
  POST /incidents/stream          → body: {incident_text} → SSE stream of LangGraph events
  POST /incidents/run             → body: {incident_text} → blocking, returns full result
  ```
- [ ] `constitution_builder.py`:
  - Accept GitHub username
  - Call Person 3's `github_ingest` to get raw data
  - Claude Sonnet prompt: turn GitHub data → structured Constitution JSON
  - Save to Firestore via Person 3's `memory_store`
- [ ] SSE streaming endpoint — consume `graph.astream_events()`, emit each step to frontend:
  ```python
  @app.get("/incidents/stream")
  async def stream_incident(incident_text: str):
      async def event_generator():
          async for event in graph.astream_events({"incident_text": incident_text}):
              yield f"data: {json.dumps(event)}\n\n"
      return StreamingResponse(event_generator(), media_type="text/event-stream")
  ```
- [ ] CORS setup so React frontend can connect
- [ ] Health check endpoint for deployment

**Deliverable:** Running FastAPI server, `POST /incidents/stream` streams LangGraph events as SSE.

---

### Person 3 — GitHub Ingestion + Memory Stores
**You own:** `backend/integrations/` + `backend/agents/memory_store.py` + `backend/agents/vector_memory.py`

**Goal:** Real data in, persistent memory out. The foundation everyone else builds on.

**Tasks:**
- [ ] `github_ingest.py`:
  - `get_user_data(username)` → pulls: recent commits (last 90 days), PRs authored + reviewed, files touched (from commit diffs), languages used, review comments
  - Returns structured dict ready for Claude to consume
- [ ] `ownership_map.py`:
  - Parse git log of a repo → build `{filepath: primary_owner_username}` map
  - Simple heuristic: whoever has most commits touching a file owns it
  - Returns ownership map as dict
- [ ] `memory_store.py` (Firestore):
  - `save_constitution(agent_id, constitution_dict)`
  - `get_constitution(agent_id)` → returns dict
  - `patch_constitution(agent_id, block_name, updates)` → partial update
  - `list_all_agents()` → returns all agent IDs + summary
- [ ] `vector_memory.py` (ChromaDB):
  - `embed_and_store(text, metadata)` — uses `sentence-transformers` locally
  - `semantic_search(query, top_k=5)` → returns relevant past incidents/constitutions
  - `store_incident(incident_text, resolution, agents_involved)` — called after each resolved incident
- [ ] Pre-load 3 demo developer profiles from real public GitHub accounts (pick 3 devs from a popular open source project for a realistic demo)
- [ ] `requirements.txt`: `chromadb`, `sentence-transformers`, `PyGitHub`, `firebase-admin`

**Key code:**
```python
# vector_memory.py
import chromadb
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")  # free, ~80MB, runs local
client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_or_create_collection("aubi_memory")

def semantic_search(query: str, top_k: int = 5):
    embedding = model.encode(query).tolist()
    return collection.query(query_embeddings=[embedding], n_results=top_k)
```

**Deliverable:** Working GitHub pipeline + Firestore read/write + ChromaDB semantic search, with 3 real demo profiles pre-loaded.

---

### Person 4 — React Frontend
**You own:** `frontend/`

**Goal:** Make judges say "wow." The frontend is the demo — it has to look incredible and show the agents working in real time.

**Tasks:**
- [ ] `npm create vite@latest frontend -- --template react-ts && cd frontend && npm i tailwindcss axios`
- [ ] **Agent Cards** (`AgentCard.tsx`):
  - GitHub avatar + name + role
  - Expertise tag pills
  - Code ownership file paths (clickable)
  - Collaboration style blurb
  - "Memory version: 3" badge
  - Subtle pulsing "online" indicator
- [ ] **Incident Console** (`IncidentConsole.tsx`):
  - Large dark textarea: "Paste Slack thread or error here..."
  - Big red "Trigger Incident" button
  - Keyboard shortcut: Cmd+Enter
- [ ] **Live Agent Activity Feed** (`AgentActivityFeed.tsx`):
  - Consumes SSE from `/incidents/stream`
  - Each LangGraph node event shows as a chat bubble with the node name + output
  - Animated "thinking" spinner per active node
  - Color coded: analyzer = blue, router = yellow, querier = purple, drafter = green
  - Scroll to latest automatically
- [ ] **Response Panel** (`ResponsePanel.tsx`):
  - Left: drafted Slack message in a Slack-style mockup UI
  - Right: postmortem markdown rendered
  - Bottom: "Memory updated" chips showing which agents' constitutions changed
- [ ] **Top nav:** AUBI logo, "4 agents online" count, dark mode toggle
- [ ] Wire SSE: `const es = new EventSource('/incidents/stream?incident_text=...')`

**Deliverable:** Full React app, dark theme, connects to FastAPI, streams agent activity in real time. Looks polished enough for a demo video.

---

## Timeline

| Time | What's happening |
|---|---|
| **9:00–9:30** | Everyone clones repo, installs deps, sets up `.env` with `ANTHROPIC_API_KEY`. Agree on exact API contracts below. |
| **9:30–11:00** | Parallel build sprint — each person owns their section, no blocking each other |
| **11:00–11:30** | Integration checkpoint #1 — Person 1 + 2: connect graph to FastAPI. Person 3 + 4: connect Firestore data to frontend agent cards |
| **11:30–1:00** | Full pipeline working end-to-end with hardcoded/mock incident. Fix integration bugs. |
| **1:00–1:30** | Lunch |
| **1:30–3:00** | Swap mock data for real GitHub data (Person 3 loads real profiles). Tune Claude prompts for better output quality. |
| **3:00–4:30** | Full demo run-through 3x. Fix any breaking edge cases. Person 4 polishes UI. |
| **4:30–5:30** | Deploy backend to Railway (`railway up`). Verify end-to-end on prod URL. |
| **5:30–6:30** | Record demo video (Loom). Write DevPost description. |
| **6:30–7:00** | Submit on DevPost. Breathe. |

---

## Agreed API Contracts (lock this down at 9:30am)

```
# Backend (FastAPI, port 8000)
GET  /agents                          → [{id, name, role, expertise[], code_ownership[]}]
GET  /agents/{id}                     → full Constitution JSON
POST /agents/build                    → body: {github_username: str} → {agent_id, constitution}
POST /incidents/run                   → body: {incident_text: str} → full AUBIState
GET  /incidents/stream                → query: incident_text → SSE stream of LangGraph events
GET  /memory/search                   → query: q=str → [{text, metadata, score}]
GET  /ownership                       → query: filepath=str → {owner_agent_id, confidence}

# Frontend (port 5173)
# Calls above endpoints via axios / EventSource
```

---

## Environment Variables

```bash
# .env in backend/
ANTHROPIC_API_KEY=sk-ant-...          # Only paid API needed
GITHUB_TOKEN=ghp_...                  # Free — GitHub personal access token
FIREBASE_PROJECT_ID=aubi-hackathon
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json

# ChromaDB — no config needed, persists to ./chroma_db automatically
# sentence-transformers — no config needed, downloads model on first run (~80MB)
```

---

## Installation (run at 9:00am)

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install langgraph langchain-anthropic langchain-core fastapi uvicorn \
            chromadb sentence-transformers PyGitHub firebase-admin python-dotenv

# Frontend
cd frontend
npm install
```

---

## Claude Prompt Templates

### Constitution Builder (Person 2)
```
You are analyzing a software developer's GitHub activity to build a Context Constitution.

GitHub data for {username}:
- Recent commits: {commits}
- PRs authored: {prs}
- Files most frequently changed: {files}
- Languages used: {languages}
- PR review comments written: {review_comments}

Generate a JSON Context Constitution with these exact blocks:
- persona: name, role (infer from commit messages/bio), team, expertise
- work: code_ownership (top file paths), current_focus (infer from recent commits), known_issues
- collaboration: communication_pref, review_style, how_to_engage, dont
- team: shared_context, shared_pain_points

Be specific. Infer from patterns, not just keywords. Return valid JSON only.
```

### Incident Analyzer (Person 1)
```
You are analyzing a production incident report. Extract:
1. affected_service: which service/module is failing
2. error_type: type of error (500, timeout, null pointer, etc.)
3. affected_files: likely file paths involved (infer from service name)
4. urgency: P1/P2/P3
5. timeline: when it started

Incident text: {incident_text}

Return JSON only.
```

### Response Drafter (Person 1)
```
Draft a Slack incident response message.

Primary owner's communication style: {collaboration_block}
Incident: {incident_summary}
Owner's relevant context: {agent_context}
Resolution direction: {resolution}

Write the Slack message as if you ARE {owner_name}, in their exact style.
Then write a postmortem skeleton in markdown.
```

---

## What Makes This Win

1. **Novel architecture:** Multi-agent graph with behavioral constitutions — not a chatbot or RAG wrapper
2. **Research-grounded:** Inspired by Letta's Context Constitution, MemGPT memory blocks, OpenAgents distributed mesh
3. **Self-learning:** Constitutions update after every incident — the system gets smarter over time
4. **Demo is visceral:** Real-time streaming shows agents "thinking" — judges see the intelligence happening
5. **Story:** *"Every org loses knowledge constantly — AUBI makes it immortal and actionable"*
6. **Technical depth:** LangGraph + Claude + ChromaDB + sentence-transformers + Firestore — real engineering, not a tutorial project

---

## Stretch Goals (only if core is done by 3pm)

- [ ] Voice input: Web Speech API → incident text (zero API cost, runs in browser)
- [ ] Constitution diff view: "Here's what Agent Alice learned today" — before/after blocks
- [ ] Agent health score: how complete/confident is each constitution? (based on data richness)
- [ ] Cross-team query: "Does anyone on any team have context on the Redis connection pooling issue?"
- [ ] LangGraph graph visualization in the UI (LangGraph has a built-in viz format)
