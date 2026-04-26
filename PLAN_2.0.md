# AUBI 2.0 — Autonomous Understanding & Behaviour Inference
### GDSC Hackathon 2026 · UMD · April 26

**Target prizes:** Best App for Developer Productivity · Best Use of Gemini (we use Claude — still qualifies for dev productivity + most creative)

---

## TL;DR — Reuse Assessment

We have two existing repos on this machine. **Cognoxent/aubi is ~70% of what we need.** Do NOT build from scratch.

| What AUBI needs | Already exists in | Reuse |
|---|---|---|
| Persistent AI agent per dev | `cognoxent/services/harness/app/graphs/aubi_agent.py` | ✅ Direct — just change system prompt |
| Developer identity / constitution | `cognoxent/services/harness/app/graphs/prompt_builder.py` | ✅ Extend with constitution blocks |
| Vector memory (semantic facts, episodes) | `cognoxent/services/knowledge/` (Qdrant) | ✅ Direct — use as constitution store |
| Self-learning loop | `cognoxent/services/knowledge/app/extraction/post_session.py` | ✅ Direct — already extracts facts/lessons |
| Memory context injection | `cognoxent/services/knowledge/app/retrieval/context_builder.py` | ✅ Direct |
| Multi-agent orchestration | `Hack25/orchestrator-langgraph/app/graphs/` (LangGraph) | ✅ Patterns + state types |
| SSE streaming / agent activity feed | `Hack25/orchestrator-langgraph/app/streaming/sse_events.py` | ✅ Direct — full event system |
| FastAPI backend | Both repos — already set up | ✅ Copy + extend |
| Specialized subagents | `cognoxent/services/harness/app/graphs/subagents.py` | ✅ Extend |
| Next.js frontend with chat + tool cards | `cognoxent/apps/aubi-web` | ✅ Extend — add incident console |
| **GitHub ingestion** | Nothing | ❌ BUILD NEW |
| **Incident routing graph** | Nothing | ❌ BUILD NEW |
| **Agent-to-agent query endpoint** | Nothing | ❌ BUILD NEW |
| **Agent cards / constitution UI** | Nothing | ❌ BUILD NEW components |

**Conclusion:** 3 people extend existing code, 1 person builds the only truly new pieces (GitHub ingestion + incident graph). We ship in 8 hours.

---

## Architecture

```
                     Incident Text (pasted Slack thread)
                              │
                    ┌─────────▼──────────┐
                    │  Incident Graph     │  ← NEW (LangGraph)
                    │  (new, ~200 lines)  │
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
   │ aubi_    │         │ aubi_    │          │ aubi_    │
   │ agent.py │◄──────► │ agent.py │◄────────►│ agent.py │
   │ (harness)│  NEW    │ (harness)│  NEW     │ (harness)│
   └────┬─────┘  /query └────┬─────┘  /query  └────┬─────┘
        │        endpoint         │                  │
        └──────────────┬──────────┘──────────────────┘
                       │
              ┌────────▼─────────┐
              │  Knowledge Svc    │  ← EXISTING (Qdrant)
              │  - semantic_facts │    extended with
              │  - episodes       │    constitution blocks
              │  - procedures     │    from GitHub ingestion
              └──────────────────┘
```

### What Each Agent Looks Like After Our Changes

**Before (existing Aubi):** Generic AI coworker with web search and file tools

**After (AUBI):** Dev-specialized coworker with a Context Constitution pre-loaded into its Qdrant memory:
- `semantic_facts` → code ownership facts ("Alice owns auth/, billing/")
- `episodes` → past incidents Alice was involved in
- `procedures` → Alice's preferred debugging patterns

The **constitution is just Qdrant facts**. We populate it from GitHub on agent creation. The self-learning loop (`post_session.py`) keeps it updated after every incident.

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
**Base off:** `Hack25/orchestrator-langgraph/app/graphs/orchestrator_v3.py` patterns

**Goal:** The incident routing brain — the new LangGraph graph that takes a pasted incident and orchestrates the multi-agent response.

**Files to create:**
```
backend/
├── graphs/
│   ├── incident_graph.py    ← NEW - the main LangGraph
│   └── state.py             ← NEW - AUBIIncidentState
└── api/
    └── incidents.py         ← NEW - FastAPI routes
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
- [ ] `POST /agents/{id}/query` — NEW endpoint: load agent `id`'s constitution from Qdrant, ask Claude "given this constitution, what context is relevant to incident X?", return answer

**Deliverable:** `POST /incidents/stream` streams agent activity; final state has Slack message + postmortem.

```python
# incident_graph.py skeleton — adapt from orchestrator_v3.py patterns
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
**Base off:** `cognoxent/services/knowledge/` (Qdrant) + `cognoxent/services/harness/app/graphs/prompt_builder.py`

**Goal:** The pipeline that turns GitHub data → Context Constitution → Qdrant facts. Also extend the existing knowledge service to expose constitution-specific endpoints.

**Files to modify/create:**
```
cognoxent/services/knowledge/app/
├── constitution/
│   ├── builder.py          ← NEW - GitHub data → Claude → Qdrant facts
│   └── schema.py           ← NEW - Pydantic models for constitution facts
└── api/routes/
    └── constitution.py     ← NEW - REST routes for constitution CRUD
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
- [ ] `constitution.py` routes:
  - `POST /constitution/build` — body: `{github_username, user_id, tenant_id}` → triggers builder
  - `GET /constitution/{user_id}` → returns all facts grouped by category
  - `PATCH /constitution/{user_id}` → update specific facts (for memory_updater node)
- [ ] Modify `cognoxent/services/harness/app/graphs/prompt_builder.py` — add a `DEVELOPER_CONSTITUTION` section that gets injected when the agent is a dev-mode Aubi (constitution facts pulled from Qdrant)

**Deliverable:** `POST /constitution/build?github_username=alicechen` populates Qdrant and returns constitution JSON. `/constitution/{user_id}` returns the living profile.

---

### Person 3 — GitHub Ingestion + Agent Registry
**Base off:** Nothing (truly new) — but use patterns from `cognoxent/services/knowledge/`

**Goal:** Pull real GitHub data for developers, parse it into structured form, and create the agent registry so the incident graph knows which agents exist.

**Files to create:**
```
backend/
├── ingestion/
│   ├── github_ingest.py     ← NEW - GitHub API → structured data
│   └── ownership_map.py     ← NEW - git log → file → owner map
└── api/
    └── agents.py            ← NEW - agent registry endpoints
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
**Base off:** `cognoxent/apps/aubi-web` (Next.js 16 + Tailwind + shadcn/ui)

**Goal:** Extend the existing Aubi web app with the two new views that make the demo work. Don't rebuild — add components on top.

**Files to create/modify:**
```
cognoxent/apps/aubi-web/src/
├── app/
│   ├── page.tsx              ← MODIFY - add routing to new views
│   ├── agents/
│   │   └── page.tsx          ← NEW - agent cards dashboard
│   └── incident/
│       └── page.tsx          ← NEW - incident console
└── components/
    ├── AgentCard.tsx          ← NEW
    ├── ConstitutionPanel.tsx  ← NEW - expandable constitution viewer
    ├── IncidentConsole.tsx    ← NEW - paste + trigger
    ├── AgentActivityFeed.tsx  ← NEW - SSE stream display
    └── ResponsePanel.tsx      ← NEW - Slack msg + postmortem output
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
- [ ] Nav bar: AUBI logo + "Agents" and "Incidents" nav links + dark mode already there
- [ ] Wire SSE: `const es = new EventSource(\`/api/incidents/stream?incident_text=...\`)`

**Deliverable:** Two polished pages demo-ready. The incident page streams agent activity in real time. Looks slick enough for a demo video.

---

## Revised Timeline

| Time | What's happening |
|---|---|
| **9:00–9:30** | Everyone: Clone repos, set up `.env`. Agree on the API contracts below. Person 4 opens `aubi-web` in browser to see existing UI. |
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

# If using existing cognoxent knowledge service
KNOWLEDGE_SERVICE_URL=http://localhost:8002
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

# 2. Knowledge service (Person 2's base)
cd /Users/intern/Desktop/xFoundry/aubi/cognoxent/services/knowledge
python3.11 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env && uvicorn app.main:app --port 8002 --reload

# 3. Backend (Persons 1 + 3)
mkdir -p /Users/intern/Desktop/xFoundry/aubi/cognoxent/services/incident-backend
cd /Users/intern/Desktop/xFoundry/aubi/cognoxent/services/incident-backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install langgraph langchain-anthropic langchain-core fastapi uvicorn PyGitHub python-dotenv httpx

# 4. Frontend (Person 4)
cd /Users/intern/Desktop/xFoundry/aubi/cognoxent/apps/aubi-web
npm install && npm run dev
```

---

## What We're Reusing vs. Building

```
FROM cognoxent/services/knowledge:
  ✅ Qdrant client + collections setup       (5h of work saved)
  ✅ Embedding service (sentence-transformers already wired)
  ✅ Context builder (50k token budget injection)
  ✅ Post-session extraction → self-learning loop
  ✅ Scoped memory (per-user isolation)

FROM cognoxent/services/harness:
  ✅ FastAPI app structure                   (2h saved)
  ✅ Aubi agent system prompt patterns
  ✅ Deep Agents + subagents patterns
  ✅ AG-UI SSE streaming events

FROM Hack25/orchestrator-langgraph:
  ✅ State TypedDict patterns                (1h saved)
  ✅ SSE event types (AgentActivityData etc.)
  ✅ LangGraph supervisor v3 patterns
  ✅ Prompt registry pattern

NEW code we write today:
  ❌ GitHub ingestion (~150 lines, Person 3)
  ❌ Constitution builder prompt + Qdrant writer (~100 lines, Person 2)
  ❌ Incident routing LangGraph (~200 lines, Person 1)
  ❌ Agent mesh /query endpoint (~50 lines, Person 1)
  ❌ Frontend agent cards + incident console (~400 lines TSX, Person 4)

Total new code: ~900 lines across 4 people = ~225 lines per person.
Rest is configuration + wiring + prompts.
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
