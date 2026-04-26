# AUBI 2.0 — Autonomous Understanding & Behaviour Inference
### GDSC Hackathon 2026 · UMD · April 26

**Target prizes:** Best App for Developer Productivity · Best Use of Gemini (we use Claude — still qualifies for dev productivity + most creative)

---

## Model Assignments

| Role | Model | Why |
|---|---|---|
| **Orchestrator** (incident analysis, routing, drafting) | **Claude Sonnet** (`claude-sonnet-4-5`) | Best reasoning + planning for the complex multi-step flow |
| **Agent queries** (fast per-agent constitution look-up) | **Claude Haiku** | Cheap, fast, good at following structured constitution |
| **Constitution building** (GitHub → facts) | **Claude Sonnet** | Long context, structured JSON output quality |

> API needed: `ANTHROPIC_API_KEY`

---

## Scaffolded Files — Already Written

These files are already written and in `backend/`. Each person starts here.

```
backend/
├── main.py                          ✅ WRITTEN — FastAPI app with all endpoints
├── requirements.txt                 ✅ WRITTEN — all deps
├── .env.example                     ✅ WRITTEN — env template
├── graphs/
│   ├── state.py                     ✅ WRITTEN — AUBIIncidentState TypedDict
│   ├── incident_graph.py            ✅ WRITTEN — full LangGraph (5 nodes)
│   ├── sse_events.py                ✅ WRITTEN — SSE event types
│   ├── deep_agent_event_mapper.py   ✅ WRITTEN — SSE event mapping
│   ├── prompt_builder.py            ✅ WRITTEN — prompt assembly helpers
│   └── memory_scopes.py             ✅ WRITTEN — memory namespace helpers
├── ingestion/
│   └── github_ingest.py             ✅ WRITTEN — GitHub API → structured data
└── constitution/
    └── builder.py                   ✅ WRITTEN — GitHub data → Claude → Qdrant facts
```

**Person 1:** `incident_graph.py` is done. Wire it to FastAPI in `main.py` (already wired). Tune the node prompts.
**Person 2:** `builder.py` is done. Add Qdrant storage using reference patterns.
**Person 3:** `github_ingest.py` is done. Add `POST /agents` wiring + agent registry.
**Person 4:** Build the two new pages: agent cards dashboard + incident console.

---

## Architecture

```
                     Incident Text (pasted Slack thread)
                              │
                    ┌─────────▼──────────┐
                    │  Incident Graph     │  ← LangGraph
                    │  (~200 lines)       │
                    │  - analyze incident │
                    │  - query ownership  │
                    │  - call agent APIs  │
                    │  - draft response   │
                    └─────────┬──────────┘
                              │
          ┌───────────────────┼────────────────────┐
          ▼                   ▼                    ▼
   Aubi Agent A         Aubi Agent B         Aubi Agent C
   (Dev Alice)          (Dev Bob)             (Dev Carol)
   ┌──────────┐         ┌──────────┐          ┌──────────┐
   │ Claude   │         │ Claude   │          │ Claude   │
   │ Haiku    │◄──────► │ Haiku    │◄────────►│ Haiku    │
   │ + const. │  /query │ + const. │  /query  │ + const. │
   └────┬─────┘ endpoint└────┬─────┘  endpoint└────┬─────┘
        │                    │                      │
        └──────────────┬─────┘──────────────────────┘
                       │
              ┌────────▼─────────┐
              │  Knowledge Svc    │  ← Qdrant
              │  - semantic_facts │    populated from
              │  - episodes       │    GitHub ingestion
              │  - procedures     │    (Context Constitution)
              └──────────────────┘
```

### What Each Agent Looks Like

Each developer agent has a **Context Constitution** pre-loaded into its Qdrant memory:
- `semantic_facts` → code ownership facts ("Alice owns auth/, billing/")
- `episodes` → past incidents Alice was involved in
- `procedures` → Alice's preferred debugging patterns

The **constitution is just Qdrant facts**. We populate it from GitHub on agent creation. The self-learning loop keeps it updated after every incident.

---

## New: Context Constitution

Stored as Qdrant `semantic_facts` with category tags. Built from GitHub by Claude. Example points:

```
{subject: "alice", predicate: "owns", object: "auth/ directory", category: "code_ownership", confidence: 0.95}
{subject: "alice", predicate: "expertise", object: "Go, Kafka, distributed systems", category: "expertise", confidence: 0.9}
{subject: "alice", predicate: "prefers", object: "async comms, detailed write-ups before asking", category: "collaboration", confidence: 0.8}
{subject: "alice", predicate: "currently_working_on", object: "payment retry logic refactor", category: "current_focus", confidence: 0.85}
{subject: "alice", predicate: "knows_issue", object: "auth token race condition on mobile", category: "known_issues", confidence: 0.9}
```

Each fact is embedded and stored with `scope: "user", scope_id: alice_id`. The knowledge service's `context_builder.py` assembles these into a memory context injected into Alice's Aubi at session start.

---

## Demo Flow (what judges see — ~15 seconds end-to-end)

1. **Dashboard** shows 3 developer cards, each with their auto-generated constitution: code ownership tags, expertise pills, current focus, collaboration style — all pulled from GitHub via Claude.

2. **Incident console** — user pastes:
   > `"prod down, payment service 500s, started 20min ago, no idea why"`

3. **Agent activity feed streams live** (from SSE events):
   - `incident_analyzer` → "Payment service, 500 errors, billing/ affected"
   - `ownership_router` → "Checking Qdrant... Alice owns billing/. Querying her agent."
   - `agent_querier[Alice]` → "Alice's constitution: tracking retry logic bug. Known issue matches pattern."
   - `response_drafter` → "Drafting Slack in Alice's communication style..."

4. **Response panel** shows:
   - ✅ Slack message written in Alice's voice and style
   - ✅ Postmortem skeleton with timeline + action items pre-assigned
   - ✅ "Constitution updated: Alice's retry logic issue marked resolved"

---

## Team Division of Work

### Person 1 — Incident Graph (LangGraph) + Agent Mesh API

**Goal:** The incident routing brain — the LangGraph graph that takes a pasted incident and orchestrates the multi-agent response.

**Files to create:**
```
backend/
├── graphs/
│   ├── incident_graph.py    ← main LangGraph
│   └── state.py             ← AUBIIncidentState
└── api/
    └── incidents.py         ← FastAPI routes
```

**Tasks:**
- [ ] Define `AUBIIncidentState` (incident_text, affected_files, owners, agent_contexts, drafted_response, postmortem, stream_log)
- [ ] `incident_analyzer` node — Claude Haiku extracts: service, error type, affected files from raw text
- [ ] `ownership_router` node — queries Qdrant `semantic_facts` for `predicate: "owns"` facts matching affected files → returns list of agent IDs
- [ ] `agent_querier` node — for each relevant agent, HTTP call to `/agents/{id}/query` endpoint with the incident summary; collects their constitution-based context
- [ ] `response_drafter` node — Claude Sonnet: draft Slack response in primary owner's communication style + generate postmortem markdown
- [ ] `memory_updater` node — after response is accepted, post to knowledge service to update episode/fact stores
- [ ] Wire the StateGraph, compile it
- [ ] `POST /incidents/run` — blocking endpoint using `graph.ainvoke()`
- [ ] `GET /incidents/stream` — SSE endpoint using `graph.astream_events()` → emit as text/event-stream
- [ ] `POST /agents/{id}/query` — endpoint: load agent `id`'s constitution from Qdrant, ask Claude "given this constitution, what context is relevant to incident X?", return answer

**Deliverable:** `POST /incidents/stream` streams agent activity; final state has Slack message + postmortem.

```python
# incident_graph.py skeleton
from langgraph.graph import StateGraph, END
from langchain_anthropic import ChatAnthropic

sonnet = ChatAnthropic(model="claude-sonnet-4-5-20251001")
haiku  = ChatAnthropic(model="claude-haiku-20240307")

builder = StateGraph(AUBIIncidentState)
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

---

### Person 2 — Constitution Builder + Knowledge Service Extension

**Goal:** The pipeline that turns GitHub data → Context Constitution → Qdrant facts. Also expose constitution-specific endpoints.

**Files to create:**
```
backend/
└── constitution/
    ├── builder.py          ← GitHub data → Claude → Qdrant facts
    ├── schema.py           ← Pydantic models for constitution facts
    └── routes.py           ← REST routes for constitution CRUD
```

**Tasks:**
- [ ] `schema.py` — Pydantic models: `ConstitutionFact`, `ContextConstitution`
- [ ] `builder.py`:
  - Accept structured GitHub data (from Person 3's ingestion)
  - Claude Sonnet prompt: "Given this GitHub activity, extract structured facts about this developer"
  - Parse JSON response → list of `ConstitutionFact` objects
  - Store each fact as a Qdrant point in `semantic_facts` with `category` tag and `scope: "user"`
  - Return summary of how many facts were stored per category
- [ ] Claude prompt for constitution building (in `builder.py`):
  ```
  Analyze this GitHub data and extract structured facts about developer {username}.
  Return JSON array of facts. Each fact: {subject, predicate, object, confidence, category}
  Categories: code_ownership, expertise, collaboration, current_focus, known_issues
  Examples:
  {"subject": "{username}", "predicate": "owns", "object": "auth/ directory", "category": "code_ownership", "confidence": 0.9}
  {"subject": "{username}", "predicate": "prefers", "object": "async communication with detailed context", "category": "collaboration", "confidence": 0.8}
  ```
- [ ] `routes.py` endpoints:
  - `POST /constitution/build` — body: `{github_username, user_id, tenant_id}` → triggers builder
  - `GET /constitution/{user_id}` → returns all facts grouped by category
  - `PATCH /constitution/{user_id}` → update specific facts (for memory_updater node)
- [ ] `prompt_builder.py` — add a `DEVELOPER_CONSTITUTION` section injected at agent session start (constitution facts pulled from Qdrant)

**Deliverable:** `POST /constitution/build?github_username=alicechen` populates Qdrant and returns constitution JSON. `/constitution/{user_id}` returns the living profile.

---

### Person 3 — GitHub Ingestion + Agent Registry

**Goal:** Pull real GitHub data for developers, parse it into structured form, and create the agent registry so the incident graph knows which agents exist.

**Files to create:**
```
backend/
├── ingestion/
│   ├── github_ingest.py     ← GitHub API → structured data
│   └── ownership_map.py     ← git log → file → owner map
└── api/
    └── agents.py            ← agent registry endpoints
```

**Tasks:**
- [ ] `github_ingest.py` — given a GitHub username, pull via `PyGitHub`:
  - Last 90 days of commits (messages, files changed)
  - PRs authored (title, description, files touched)
  - PR review comments (what they nitpick = expertise signals)
  - Repository languages (from repos they contribute to most)
  - Return structured dict ready for Person 2's constitution builder
- [ ] `ownership_map.py` — given a git repo path or GitHub repo:
  - Run `git log --follow --name-only` or use GitHub API's commit history
  - Build `{filepath → primary_owner_github_handle}` map (whoever touched it most = owner)
  - Cache in a simple JSON file or in-memory dict for demo
- [ ] `agents.py` FastAPI routes:
  - `GET /agents` → list all registered agents with summary constitution (name, role, top 3 owned files, expertise tags)
  - `GET /agents/{id}` → full constitution JSON (calls `/constitution/{user_id}` on knowledge service)
  - `POST /agents` → body: `{github_username, name, role}` → calls GitHub ingestion + constitution builder + returns agent
- [ ] Pre-load 3 demo agents from real public GitHub profiles before demo (find 3 devs on a popular Go/Python OSS project)
- [ ] Health + ready endpoints for deployment

**Key code:**
```python
# github_ingest.py
from github import Github

def ingest_developer(github_username: str, token: str) -> dict:
    g = Github(token)
    user = g.get_user(github_username)
    
    commits_data, prs_data, files_touched = [], [], []
    # ... pull data
    
    return {
        "username": github_username,
        "name": user.name,
        "bio": user.bio,
        "commits": commits_data,      # [{message, files, repo, date}]
        "prs": prs_data,              # [{title, body, files, repo}]
        "files_touched": files_touched,  # [{path, count, repo}]
        "languages": dict(user.get_repos()),
        "review_comments": [...],
    }
```

**Deliverable:** `POST /agents` with a GitHub username creates a new agent, populates its constitution, and returns it ready for the incident graph to use.

---

### Person 4 — Frontend: Agent Cards + Incident Console

**Goal:** Build two polished views: an agent dashboard and an incident console. Next.js + Tailwind + shadcn/ui.

**Files to create:**
```
frontend/src/
├── app/
│   ├── page.tsx              ← routing to new views
│   ├── agents/
│   │   └── page.tsx          ← agent cards dashboard
│   └── incident/
│       └── page.tsx          ← incident console
└── components/
    ├── AgentCard.tsx
    ├── ConstitutionPanel.tsx  ← expandable constitution viewer
    ├── IncidentConsole.tsx    ← paste + trigger
    ├── AgentActivityFeed.tsx  ← SSE stream display
    └── ResponsePanel.tsx      ← Slack msg + postmortem output
```

**Tasks:**
- [ ] **Agent Cards view** (`/agents`):
  - Fetch `GET /agents` → render cards in a grid
  - Each card: GitHub avatar, name, role tag, 3 ownership file badges, expertise tags, collaboration style snippet
  - Click card → expand `ConstitutionPanel` showing full grouped facts
  - "Memory version N" badge + last-updated timestamp
  - Pulsing green "online" dot on each card
- [ ] **Incident Console** (`/incident`):
  - Full-width dark textarea: "Paste Slack thread or error message..."
  - Big red "Trigger Incident →" button (Cmd+Enter shortcut)
  - Clears and shows loading skeleton on submit
- [ ] **Agent Activity Feed** (on `/incident` page, right side):
  - Connect to `GET /incidents/stream` SSE
  - Each LangGraph event → rendered as a timeline item with:
    - Node name badge (colored: blue=analyze, yellow=route, purple=query, green=draft)
    - Short description of what the node did
    - Animated spinner while node is active
  - Auto-scroll to latest
- [ ] **Response Panel** (bottom of `/incident`):
  - Left: Slack message in a Slack-style bubble mockup (dark sidebar, avatar, timestamp)
  - Right: Postmortem markdown rendered (use `react-markdown`)
  - Bottom strip: "Agent Alice's constitution updated" chips with memory block name
- [ ] Nav bar: AUBI logo + "Agents" and "Incidents" nav links + dark mode
- [ ] Wire SSE: `const es = new EventSource(\`/api/incidents/stream?incident_text=...\`)`

**Deliverable:** Two polished pages demo-ready. The incident page streams agent activity in real time.

---

## Revised Timeline

| Time | What's happening |
|---|---|
| **9:00–9:30** | Everyone: Set up `.env`. Agree on the API contracts below. Person 4 scaffolds Next.js project. |
| **9:30–11:30** | Parallel build — each person owns their section, zero blocking. |
| **11:30–12:00** | Integration checkpoint #1: Person 1 + 2 wire incident graph → knowledge service. Person 3 + 4 wire agent registry → frontend cards. |
| **12:00–1:00** | Full pipeline running with pre-loaded mock constitutions. Person 1 confirms SSE streams to Person 4's frontend. |
| **1:00–1:30** | Lunch |
| **1:30–3:00** | Person 3 loads real GitHub data for 3 demo devs. Everyone tunes Claude prompts for better output quality. |
| **3:00–4:30** | 3x full demo run-throughs. Fix bugs. Person 4 final UI polish. |
| **4:30–5:30** | Deploy to Railway or Vercel. Confirm prod URLs work. |
| **5:30–6:30** | Record demo video (Loom). Write DevPost. |
| **6:30–7:00** | Submit. |

---

## Agreed API Contracts (lock at 9:30am)

```
# Backend — port 8000

# Agents
GET  /agents                          → [{id, github_username, name, role, expertise[], code_ownership[]}]
GET  /agents/{id}                     → full ContextConstitution JSON
POST /agents                          → body: {github_username, name, role} → creates agent, returns constitution
POST /agents/{id}/query               → body: {incident_text} → returns agent's relevant context string

# Incidents
POST /incidents/run                   → body: {incident_text} → blocks, returns full result
GET  /incidents/stream                → query: incident_text → SSE stream of LangGraph events

# Constitution (internal, called by incident graph)
GET  /constitution/{user_id}          → all facts grouped by category
PATCH /constitution/{user_id}         → update specific facts

# Ownership
GET  /ownership                       → query: filepath → {owner_agent_id, confidence}
```

```
# SSE Event format (from Person 1, consumed by Person 4 frontend)
data: {"node": "incident_analyzer", "status": "running", "output": null}
data: {"node": "incident_analyzer", "status": "done", "output": {"service": "payment", "files": ["billing/"]}}
data: {"node": "ownership_router", "status": "running", "output": null}
data: {"node": "ownership_router", "status": "done", "output": {"owners": ["alice_id"]}}
data: {"node": "agent_querier", "status": "running", "output": null, "agent": "alice"}
data: {"node": "agent_querier", "status": "done", "output": {"context": "Alice owns retry logic..."}}
data: {"node": "response_drafter", "status": "done", "output": {"slack_msg": "...", "postmortem": "..."}}
data: {"node": "memory_updater", "status": "done", "output": {"updated": ["alice_id"]}}
```

---

## Environment Variables

```bash
# .env — only ONE paid API key needed
ANTHROPIC_API_KEY=sk-ant-...

# Free services
GITHUB_TOKEN=ghp_...                  # GitHub PAT — free
QDRANT_URL=http://localhost:6333      # local Qdrant in Docker
QDRANT_COLLECTION_PREFIX=aubi_hackathon
```

```bash
# Start Qdrant locally (one command)
docker run -p 6333:6333 qdrant/qdrant
```

---

## Quick Start Commands (run at 9:00am)

```bash
# 1. Start Qdrant
docker run -d -p 6333:6333 qdrant/qdrant

# 2. Backend (Persons 1, 2, 3)
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --port 8000 --reload

# 3. Frontend (Person 4)
cd frontend
npm install && npm run dev
```

---

## Claude Prompt Templates

### Constitution Builder (Person 2)
```
Analyze this GitHub developer data and extract structured facts.

Developer: {github_username}
GitHub data:
- Commits (last 90 days): {commits_summary}
- Files most touched: {top_files}
- PR titles authored: {pr_titles}
- Review comment patterns: {review_comments_sample}
- Primary languages: {languages}

Return a JSON array of facts. Each fact:
{
  "subject": "{github_username}",
  "predicate": "<verb>",
  "object": "<value>",
  "confidence": 0.0-1.0,
  "category": "code_ownership|expertise|collaboration|current_focus|known_issues"
}

Example good facts:
{"subject": "alicechen", "predicate": "owns", "object": "auth/ directory (85% of commits)", "confidence": 0.95, "category": "code_ownership"}
{"predicate": "prefers", "object": "async communication with detailed context before meetings", "confidence": 0.8, "category": "collaboration"}
{"predicate": "currently_working_on", "object": "refactoring payment retry logic based on recent commit messages", "confidence": 0.85, "category": "current_focus"}

Be specific. Infer from patterns. Return JSON only, no markdown.
```

### Incident Analyzer (Person 1)
```
You are analyzing a production incident. Extract:
- affected_service: which service is failing
- error_type: 500/timeout/crash/etc.
- affected_files: likely file paths (infer from service name and error)
- urgency: P1/P2/P3
- started_at: when it started (if mentioned)

Incident text: {incident_text}

Return JSON only.
```

### Agent Querier (Person 1)
```
You are {agent_name}'s AI representative. Here is their Context Constitution:
{constitution_facts}

An incident has occurred:
{incident_summary}

Based solely on this person's constitution, answer:
1. Is this incident in their domain? (yes/no/partial)
2. What relevant context do they have about this?
3. What would they likely say when paged?

Be concise. Speak as if you are the developer's knowledgeable representative.
```

### Response Drafter (Person 1)
```
Draft a Slack incident response.

Primary owner's communication style: "{communication_pref}"
Their known context: {agent_context}
Incident summary: {incident_summary}

Write the Slack message AS IF you are {owner_name} — match their style exactly.
Then write a postmortem skeleton in markdown with: Timeline, Root Cause (TBD), 
Action Items (assigned to the right people per their ownership).

Format:
SLACK:
<message here>

POSTMORTEM:
<markdown here>
```

---

## Stretch Goals (only if core done by 3pm)

- [ ] Voice input: Web Speech API in browser → incident text (zero API cost)
- [ ] Constitution diff: "Here's what Agent Alice learned from this incident" — before/after facts
- [ ] Cross-agent query: "Does anyone on the team have context on Redis connection pooling?"
- [ ] Agent health score: completeness of constitution (% of categories filled, last updated)
- [ ] Real Slack webhook receiver instead of paste box
