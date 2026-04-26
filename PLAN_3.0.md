# AUBI 3.0 — Autonomous Understanding & Behaviour Inference
### GDSC Hackathon 2026 · UMD · April 26

**Target prizes:** Best App for Developer Productivity · Most Creative · Best Use of Gemini

---

## The 90-Second Demo

**Story:** A professor files a GitHub issue. She doesn't know who to ping. AUBI's agent mesh figures it out, the right dev's AI co-worker explains the bug from its own memory, the code gets fixed, and a PR lands — zero human coordination.

| Scene | What judges see | ~Time |
|---|---|---|
| **1 — Meet the Team** | Dashboard: 3 developer cards. Click Alice → full Context Constitution auto-built from GitHub (ownership, expertise, collaboration style, known issues) | 20s |
| **2 — Issue drops** | Prof files GitHub issue: *"auth 401 blocking student submissions"*. Issue feed lights up. AUBI picks it up. | 10s |
| **3 — Agents talk** | Live comm feed: Orchestrator pings Alice's Aubi. Alice's Aubi surfaces the race condition from her constitution. Bob's Aubi flags his adjacent PR. | 30s |
| **4 — Fix generated** | Code diff panel: actual Go fix with mutex, syntax highlighted. | 15s |
| **5 — PR pushed** | Real GitHub PR appears, written in Alice's style, Bob as reviewer, issue linked and closed. | 15s |

---

## Team

| Person | Domain | Core deliverable |
|---|---|---|
| **Vitthal** | Orchestration + Context Constitution | LangGraph graph, Claude prompts, Qdrant constitution store |
| **Neil** | GitHub + Slack integration | Issue reader, code reader, PR pusher, Slack webhook |
| **Avhaang** | Frontend | Agent cards, constitution viewer, agent comm feed |
| **Mitansh** | Frontend | Issue feed, code diff panel, PR preview, live SSE wiring |

---

## Models

| Role | Model |
|---|---|
| Orchestrator (analysis, fix gen, PR body) | **Claude Sonnet** `claude-sonnet-4-5-20251001` |
| Agent constitution queries (fast) | **Claude Haiku** `claude-haiku-20240307` |
| Constitution building (GitHub → facts) | **Claude Sonnet** |

One API key: `ANTHROPIC_API_KEY`

---

## Architecture

```
                   GitHub Issue / Slack Message
                              │
                    ┌─────────▼──────────┐
                    │   AUBI Graph        │  ← Vitthal (LangGraph)
                    │                     │
                    │  issue_reader       │
                    │       ↓             │
                    │  ownership_router   │
                    │       ↓             │
                    │  query_agents (║)   │  ← parallel fan-out
                    │       ↓             │
                    │  code_reader        │  ← Neil (GitHub API)
                    │       ↓             │
                    │  fix_generator      │  ← Vitthal (Claude Sonnet)
                    │       ↓             │
                    │  pr_pusher          │  ← Neil (GitHub API)
                    └─────────┬──────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       Alice's Aubi     Bob's Aubi      Carol's Aubi
       (Haiku + const.) (Haiku + const.) (Haiku + const.)
              │               │
              └───────────────┘
                Qdrant memory             ← Vitthal (constitution store)
          (semantic_facts, episodes)

SSE stream → frontend                    ← Avhaang + Mitansh
GitHub API + Slack webhooks              ← Neil
```

---

## Scaffolded Files (already written — start here)

```
backend/
├── main.py                   ✅ FastAPI app — all endpoints wired
├── requirements.txt          ✅ all deps
├── .env.example              ✅ env template
├── graphs/
│   ├── state.py              ✅ AUBIIssueState TypedDict
│   ├── incident_graph.py     ✅ 6-node LangGraph (extend/tune prompts)
│   └── prompt_builder.py     ✅ prompt assembly helpers (from cognoxent)
├── ingestion/
│   ├── github_ingest.py      ✅ dev profile ingestion (constitution building)
│   └── github_issue.py       ✅ read_issue, read_repo_files, create_fix_pr, poll
└── constitution/
    └── builder.py            ✅ GitHub data → Claude → constitution facts
```

```
frontend base:
/Users/intern/Desktop/xFoundry/aubi/cognoxent/apps/aubi-web   ✅ Next.js 16 + Tailwind + shadcn/ui
```

---

## Vitthal — Orchestration + Context Constitution

### What you own
- The 6-node LangGraph graph (`backend/graphs/incident_graph.py`)
- Claude prompts inside each node
- Qdrant constitution store (reading + writing facts)
- The `POST /agents` flow (GitHub → facts → Qdrant)

### Files to work in
```
backend/
├── graphs/
│   ├── incident_graph.py     ← tune all node prompts, fix parallel fan-out
│   └── state.py              ← extend if needed
└── constitution/
    ├── builder.py            ← add actual Qdrant writes (currently scaffolded)
    └── store.py              ← NEW: create this for Qdrant read/write/search
```

### Tasks

**Morning (9:00–12:00)**

- [ ] **Qdrant setup** — start docker, create collections:
  ```bash
  docker run -d -p 6333:6333 qdrant/qdrant
  ```
  Collections needed: `semantic_facts`, `episodes`
  Use `constitution/qdrant_client_reference.py` + `constitution/embeddings_reference.py` as the pattern

- [ ] **`constitution/store.py`** — write these 4 functions:
  ```python
  def store_facts(facts: list[dict], user_id: str, tenant_id: str) -> int
      # embed each fact with sentence-transformers → upsert to semantic_facts
      # return count stored

  def get_facts(user_id: str) -> dict[str, list]
      # search Qdrant for all facts with scope_id=user_id
      # return grouped by category: {code_ownership: [...], expertise: [...], ...}

  def search_ownership(filepath: str) -> tuple[str | None, float]
      # semantic search semantic_facts where predicate="owns"
      # match against filepath → return (owner_agent_id, confidence)

  def add_episode(user_id: str, summary: str) -> None
      # embed summary → upsert to episodes collection
  ```

- [ ] **Wire store into `main.py`** — update these endpoints to use real Qdrant:
  - `POST /agents` → after `build_constitution_from_github()`, call `store.store_facts()`
  - `GET /constitution/{id}` → call `store.get_facts()`
  - `PATCH /constitution/{id}` → call `store.add_episode()`
  - `GET /ownership` → call `store.search_ownership(filepath)`

- [ ] **Pre-seed 3 demo agents** — hardcode constitutions for Alice, Bob, Carol so demo works even if GitHub API is slow:
  ```python
  # backend/seed_demo.py — run once at 9am
  DEMO_AGENTS = [
      {
          "id": "alice", "name": "Alice Chen", "github_username": "alicechen",
          "facts": [
              {"subject": "alice", "predicate": "owns", "object": "auth/", "category": "code_ownership", "confidence": 0.95},
              {"subject": "alice", "predicate": "owns", "object": "billing/", "category": "code_ownership", "confidence": 0.9},
              {"subject": "alice", "predicate": "expertise_in", "object": "Go, Kafka, distributed systems", "category": "expertise", "confidence": 0.9},
              {"subject": "alice", "predicate": "prefers", "object": "async communication, needs full context before meetings", "category": "collaboration", "confidence": 0.85},
              {"subject": "alice", "predicate": "currently_working_on", "object": "payment retry logic refactor", "category": "current_focus", "confidence": 0.85},
              {"subject": "alice", "predicate": "is_aware_of_issue", "object": "auth token race condition under concurrent load in auth/token.go", "category": "known_issues", "confidence": 0.92},
          ]
      },
      {
          "id": "bob", "name": "Bob Park", "github_username": "bobpark",
          "facts": [
              {"subject": "bob", "predicate": "owns", "object": "api/users/", "category": "code_ownership", "confidence": 0.9},
              {"subject": "bob", "predicate": "owns", "object": "frontend/", "category": "code_ownership", "confidence": 0.85},
              {"subject": "bob", "predicate": "expertise_in", "object": "TypeScript, React, REST APIs", "category": "expertise", "confidence": 0.88},
              {"subject": "bob", "predicate": "prefers", "object": "short messages, quick syncs over long docs", "category": "collaboration", "confidence": 0.8},
              {"subject": "bob", "predicate": "currently_working_on", "object": "user profile redesign, changed auth middleware in PR #44", "category": "current_focus", "confidence": 0.88},
          ]
      },
      {
          "id": "carol", "name": "Carol Zhang", "github_username": "carolzhang",
          "facts": [
              {"subject": "carol", "predicate": "owns", "object": "infra/", "category": "code_ownership", "confidence": 0.92},
              {"subject": "carol", "predicate": "owns", "object": "deploy/", "category": "code_ownership", "confidence": 0.9},
              {"subject": "carol", "predicate": "expertise_in", "object": "Kubernetes, Terraform, CI/CD", "category": "expertise", "confidence": 0.9},
              {"subject": "carol", "predicate": "prefers", "object": "formal runbooks, async Slack updates", "category": "collaboration", "confidence": 0.82},
          ]
      }
  ]
  ```

**Afternoon (1:30–3:30)**

- [ ] **Tune node prompts** in `incident_graph.py` — run the graph end-to-end with the demo bug and iterate until:
  - `issue_reader` correctly identifies `auth/token.go` as the affected file
  - `query_single_agent` returns Alice's race condition context in the response
  - `fix_generator` produces a valid Go mutex fix (not pseudocode)
  - Output is clean enough to show judges

- [ ] **`fix_generator` prompt** — hardcode the demo bug pattern so the fix is deterministic:
  ```
  The developer's constitution mentions a race condition in auth/token.go.
  If the source file shows a cache access without mutex locking, apply
  sync.Mutex locking around the cache read and write.
  ```

- [ ] **Test the full graph**: `curl -X POST http://localhost:8000/incidents/run -d '{"issue_url": "DEMO_REPO#1"}'`

### Key patterns from reference files
```python
# constitution/qdrant_client_reference.py → use get_qdrant_client()
# constitution/embeddings_reference.py → use embed_text(str) → list[float]
# constitution/post_session_reference.py → pattern for storing episodes
# constitution/context_builder_reference.py → pattern for searching + filtering by scope
```

---

## Neil — GitHub + Slack Integration

### What you own
- GitHub: read issues, read repo files, push PRs, poll for new issues
- Slack: receive messages as incident triggers, post resolution back
- The demo repo with the planted bug

### Files to work in
```
backend/
├── ingestion/
│   ├── github_issue.py       ← already written, test + fix edge cases
│   └── slack_integration.py  ← NEW: Slack webhook receiver + message poster
└── main.py                   ← add /slack/webhook endpoint
```

### Tasks

**First thing at 9:00 AM — Demo Repo Setup (do this before anything else)**

- [ ] Create a public GitHub repo called `AUBI-Demo` (or fork an existing one)
- [ ] Add this file as `auth/token.go` with the planted bug:
  ```go
  package auth

  import "sync"

  // TokenCache caches user tokens in memory.
  // BUG: cache map has no mutex protection — race condition under concurrent load.
  type TokenCache struct {
      cache map[string]string
      // mu sync.Mutex  ← intentionally missing
  }

  func NewTokenCache() *TokenCache {
      return &TokenCache{cache: make(map[string]string)}
  }

  func (c *TokenCache) GetOrRefresh(userID string) (string, error) {
      if cached := c.cache[userID]; cached != "" {
          return cached, nil  // concurrent reads/writes here = race condition
      }
      token, err := refreshFromDB(userID)
      if err != nil {
          return "", err
      }
      c.cache[userID] = token  // concurrent write here
      return token, nil
  }

  func refreshFromDB(userID string) (string, error) {
      // simulated DB call
      return "token_" + userID, nil
  }
  ```
- [ ] Open **Issue #1** on the repo: *"Authentication endpoint returning 401 for valid tokens after latest deployment — blocking student assignment submissions"* (author: your prof account or a test account)
- [ ] Set `DEMO_REPO=your-username/AUBI-Demo` in `.env`
- [ ] Give your `GITHUB_TOKEN` write access to this repo (it needs to push branches + create PRs)

**Morning (9:00–12:00)**

- [ ] **Test `github_issue.py`** end-to-end:
  ```bash
  python3 -c "
  from ingestion.github_issue import read_issue, read_repo_files
  print(read_issue('your-username/AUBI-Demo#1'))
  print(read_repo_files('your-username/AUBI-Demo', ['auth/token.go']))
  "
  ```
- [ ] **Fix any edge cases** in `create_fix_pr()` — test with a dummy fix first to confirm PR creation works
- [ ] **`slack_integration.py`** — two functions:
  ```python
  async def receive_slack_event(payload: dict) -> dict | None:
      """Parse a Slack event webhook payload.
      Returns {text, channel, user, ts} if it's a relevant message, else None.
      For demo: watch for messages containing 'auth', '401', or '500'.
      """

  async def post_slack_message(channel: str, text: str) -> bool:
      """Post a message to a Slack channel via Bot Token.
      Returns True on success.
      """
  ```
- [ ] **`POST /slack/webhook`** in `main.py`:
  ```python
  @app.post("/slack/webhook")
  async def slack_webhook(request: Request):
      payload = await request.json()
      # Slack URL verification challenge
      if payload.get("type") == "url_verification":
          return {"challenge": payload["challenge"]}
      event = await receive_slack_event(payload)
      if event:
          # Trigger the AUBI graph as a background task
          asyncio.create_task(run_graph_for_slack(event))
      return {"ok": True}
  ```
- [ ] **Slack bot setup** (if time allows, else skip and use GitHub issue only):
  - Create a Slack app at api.slack.com
  - Enable Event Subscriptions → point to `ngrok` tunnel during demo
  - Subscribe to `message.channels` events
  - Add bot to a channel
  - Add `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` to `.env`

**Afternoon (1:30–3:30)**

- [ ] **Full end-to-end test**: trigger via GitHub issue URL → confirm PR is created with correct file content
- [ ] **PR body quality** — confirm it reads like something Alice would actually write (not robotic)
- [ ] If Slack integration is working: test posting the fix summary back to the channel after PR is pushed
- [ ] **`GET /github/poll`** — confirm this endpoint returns the demo repo's open issue for Person 4's frontend poller

### Environment variables you need
```bash
GITHUB_TOKEN=ghp_...          # needs repo write access
DEMO_REPO=your-username/AUBI-Demo
SLACK_BOT_TOKEN=xoxb-...      # optional
SLACK_SIGNING_SECRET=...      # optional
```

---

## Avhaang — Frontend: Agent Cards + Constitution Viewer + Comm Feed

### What you own
- `/team` page — the 3 developer cards + constitution panel
- Agent communication feed (the centrepiece of the demo)
- SSE connection from backend

### Base
```
/Users/intern/Desktop/xFoundry/aubi/cognoxent/apps/aubi-web
```
Already has: Next.js 16, Tailwind CSS 4, shadcn/ui, dark theme, chat UI patterns.

### New files to create
```
apps/aubi-web/src/
├── app/
│   ├── team/page.tsx              ← agent cards dashboard
│   └── demo/page.tsx              ← main demo view (shared with Mitansh)
└── components/aubi/
    ├── AgentCard.tsx              ← developer card
    ├── ConstitutionPanel.tsx      ← expandable fact viewer
    ├── AgentMeshLines.tsx         ← animated SVG connections between cards
    └── AgentCommFeed.tsx          ← the live agent-to-agent chat feed
```

### Tasks

**Morning (9:00–12:00)**

- [ ] **`/team` page + `AgentCard.tsx`**:
  - Fetch `GET http://localhost:8000/agents` on load
  - 3 cards in a grid, each showing:
    - GitHub avatar (`https://github.com/{username}.png`)
    - Name + role tag (e.g. "Senior Backend Engineer")
    - Expertise pills: `[Go] [Kafka] [PostgreSQL]` — pull from `constitution.expertise`
    - Code ownership badges: `auth/` `billing/` — from `constitution.code_ownership`
    - Collaboration style: 1-line blurb from `constitution.collaboration`
    - "Memory v3 · 2 min ago" footer badge
    - Pulsing green dot ("online")
  - Click card → open `ConstitutionPanel` slide-over/drawer

- [ ] **`ConstitutionPanel.tsx`**:
  - Pull `GET /agents/{id}` for full constitution
  - Section per category, each with:
    - Category name (Code Ownership / Expertise / Collaboration / Current Focus / Known Issues)
    - Each fact as a row: predicate + object + confidence bar
  - Animate in from right on card click

- [ ] **`AgentMeshLines.tsx`**:
  - SVG lines drawn between the 3 agent cards
  - Lines are dim by default
  - When an `agent_message` SSE event fires: animate the line between sender and recipient (pulse, glow)
  - Use `framer-motion` or plain CSS animation

**Afternoon (1:30–3:30)**

- [ ] **`AgentCommFeed.tsx`** (the centrepiece):
  - Receives `agent_message` events from the SSE stream (Mitansh wires the SSE, you consume the events via a shared context/hook)
  - Each message renders as a chat bubble:
    ```
    [Orchestrator]    ──→   "New issue: auth 401. Is this yours?"
             [Alice's Aubi]  ←──  "Yes — matches the race condition in auth/token.go"
    [Orchestrator]    ──→   "Bob, did your PR #44 touch auth middleware?"
             [Bob's Aubi]    ←──  "Yes — changed header passing in api/users/auth_middleware.go"
    ```
  - Color per agent: Orchestrator = indigo, Alice = emerald, Bob = amber, Carol = rose
  - Sender on left → right-facing bubble, recipient on right → left-facing bubble
  - Animated "..." before each bubble appears (typing indicator)
  - Auto-scroll to latest message

- [ ] **Wire `AgentMeshLines` to the SSE events** — when a `agent_message` event fires with `sender: "alice_aubi"`, animate the Alice↔Orchestrator line

### Design principles (from existing cognoxent app)
- Dark background, light text — already there
- Subtle animations, no bounce
- Flat, airy feel — not enterprise
- Use existing shadcn components where possible (Card, Badge, ScrollArea, Sheet for panel)

---

## Mitansh — Frontend: Issue Feed + Code Diff + PR Preview + SSE

### What you own
- `/demo` page layout and SSE wiring (shared page with Avhaang's components)
- Issue feed panel (live GitHub poller)
- Code diff panel (shows the fix)
- PR preview panel (shows the push result)
- The overall demo page layout and state management

### New files to create
```
apps/aubi-web/src/
├── app/demo/page.tsx              ← main demo view layout + SSE state
└── components/aubi/
    ├── IssueFeed.tsx              ← live issue poller
    ├── CodeDiffPanel.tsx          ← syntax-highlighted diff
    └── PRPreviewPanel.tsx         ← PR mockup + real link
```

### Tasks

**Morning (9:00–12:00)**

- [ ] **`/demo` page layout**:
  - 3-column layout:
    - Left: `AgentCommFeed` (Avhaang's component)
    - Center: `CodeDiffPanel` (yours)
    - Right: `PRPreviewPanel` (yours)
  - `IssueFeed` as a top banner that slides down when a new issue arrives
  - Top nav: "AUBI Demo" + a live status pill ("Watching repo..." / "Incident active" / "Fixed ✓")

- [ ] **SSE hook** — central SSE connection that feeds all components:
  ```typescript
  // hooks/useAUBIStream.ts
  export function useAUBIStream(issueUrl: string | null) {
    const [events, setEvents] = useState<AUBIEvent[]>([])
    const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([])
    const [diff, setDiff] = useState<string | null>(null)
    const [prUrl, setPrUrl] = useState<string | null>(null)
    const [nodeStatuses, setNodeStatuses] = useState<Record<string, 'idle'|'running'|'done'>>({})

    useEffect(() => {
      if (!issueUrl) return
      const es = new EventSource(`/api/incidents/stream?issue_url=${encodeURIComponent(issueUrl)}`)
      es.onmessage = (e) => {
        const event = JSON.parse(e.data)
        if (event.event === 'agent_message')  setAgentMessages(m => [...m, event.data])
        if (event.event === 'node_start')     setNodeStatuses(s => ({...s, [event.node]: 'running'}))
        if (event.event === 'node_done') {
          setNodeStatuses(s => ({...s, [event.node]: 'done'}))
          if (event.node === 'fix_generator') setDiff(event.data?.patch_diff)
          if (event.node === 'pr_pusher')     setPrUrl(event.data?.pr_url)
        }
      }
      return () => es.close()
    }, [issueUrl])

    return { agentMessages, diff, prUrl, nodeStatuses }
  }
  ```

- [ ] **`IssueFeed.tsx`**:
  - Polls `GET /api/github/poll` every 5 seconds
  - When a new issue is returned: slide-in banner at top:
    ```
    🔴  Issue #1 by prof-chen  ·  "Authentication endpoint 401 blocking submissions"
        [Trigger AUBI →]
    ```
  - Clicking "Trigger AUBI" sets `issueUrl` in page state → starts SSE stream
  - Banner stays visible while graph is running, changes to green "✓ Fixed" when `pr_pusher` completes

- [ ] **`CodeDiffPanel.tsx`**:
  - Hidden until `fix_generator` node completes
  - Slide-in animation when diff appears
  - Use `react-syntax-highlighter` (already available or install):
    ```bash
    npm i react-syntax-highlighter @types/react-syntax-highlighter
    ```
  - Show unified diff: removed lines in red background, added lines in green
  - File path header: `auth/token.go`
  - Fix explanation text below the diff (from `event.data.fix_explanation`)

- [ ] **`PRPreviewPanel.tsx`**:
  - Hidden until `pr_pusher` node completes
  - Slides in from right when PR URL appears
  - Mockup GitHub PR card:
    ```
    ┌─────────────────────────────────────────┐
    │  fix: resolve auth token race condition  │
    │  aubi/fix-issue-1 → main                │
    │                                         │
    │  Reviewers: @alicechen  @bobpark        │
    │  Closes #1                              │
    │                                         │
    │  [Open on GitHub ↗]                    │
    └─────────────────────────────────────────┘
    ```
  - "Open on GitHub" button → links to real PR URL
  - Subtle confetti animation when PR appears (use `canvas-confetti`):
    ```bash
    npm i canvas-confetti @types/canvas-confetti
    ```

**Afternoon (1:30–3:30)**

- [ ] **Graph progress tracker** (optional but nice):
  - Small horizontal step indicator at top of demo page:
    `Issue Read → Ownership Found → Agents Consulted → Code Read → Fix Generated → PR Pushed`
  - Each step lights up as its node completes (use `nodeStatuses` from the hook)

- [ ] **Full demo rehearsal** with Avhaang — run the complete flow end-to-end:
  - Open the issue in GitHub
  - Watch `/github/poll` pick it up
  - Click "Trigger AUBI"
  - All 3 panels populate in sequence
  - Confirm the PR link is real and opens correctly

- [ ] **API proxy** — add Next.js API routes so frontend calls go to `/api/*` and proxy to `localhost:8000`:
  ```typescript
  // app/api/[...path]/route.ts  — catch-all proxy to backend
  ```
  This avoids CORS issues in the demo.

---

## API Contracts (locked)

```
# Backend — localhost:8000

GET  /agents                     → [{id, name, role, github_username, constitution_facts[]}]
GET  /agents/{id}                → {id, name, constitution: {code_ownership:[], expertise:[], ...}}
POST /agents                     → body: {github_username, name, role} → creates agent + constitution
POST /agents/{id}/query          → body: {incident_text} → {context: str}

GET  /constitution/{id}          → facts grouped by category
PATCH /constitution/{id}         → body: {fact: {...}} → appends episode

GET  /ownership                  → ?filepath=auth/  → {owner_agent_id, confidence}

POST /incidents/run              → body: {issue_url} → {pr_url, patch_diff, fix_explanation, ...}
GET  /incidents/stream           → ?issue_url=...   → SSE stream
POST /slack/webhook              → Slack event payload → triggers graph

GET  /github/poll                → {issue: {title, body, url, issue_number} | null}
GET  /health
```

```
# SSE events (backend → frontend)

{"event": "node_start",    "node": "issue_reader",       "data": null}
{"event": "node_done",     "node": "issue_reader",       "data": {"issue_title": "...", "affected_files": [...]}}
{"event": "node_start",    "node": "ownership_router",   "data": null}
{"event": "node_done",     "node": "ownership_router",   "data": {"owner_ids": ["alice", "bob"]}}
{"event": "agent_message", "data": {"sender": "orchestrator", "recipient": "alice_aubi", "message": "...", "timestamp": 0}}
{"event": "agent_message", "data": {"sender": "alice_aubi",   "recipient": "orchestrator","message": "...", "timestamp": 0}}
{"event": "node_done",     "node": "code_reader",        "data": {"files": {"auth/token.go": "..."}}}
{"event": "node_done",     "node": "fix_generator",      "data": {"patch_diff": "...", "fix_explanation": "..."}}
{"event": "node_done",     "node": "pr_pusher",          "data": {"pr_url": "https://github.com/..."}}
{"event": "complete",      "data": null}
```

---

## Timeline

| Time | Vitthal | Neil | Avhaang | Mitansh |
|---|---|---|---|---|
| **9:00–9:30** | Set up Qdrant docker. Read reference files. | **Create demo repo + plant bug. Open Issue #1.** Test GitHub token has write access. | Open `aubi-web` in browser, understand existing structure. | Same — explore existing app. |
| **9:30–11:00** | Write `constitution/store.py`. Get Qdrant reads/writes working. | Test `github_issue.py`. Fix edge cases in PR creation. Set up Slack app (or skip). | Build `AgentCard.tsx` + `/team` page. Wire `GET /agents`. | Build `/demo` page layout. Write `useAUBIStream` SSE hook. |
| **11:00–11:30** | **Checkpoint**: seed demo agents into Qdrant. Confirm `GET /ownership?filepath=auth/` returns Alice. | **Checkpoint**: confirm `read_issue()` + `read_repo_files()` work against demo repo. | **Checkpoint**: agent cards show on screen with real data. | **Checkpoint**: SSE hook connects, receives test events. |
| **11:30–1:00** | Wire Qdrant store into `main.py`. Test `POST /agents` end-to-end. | Test `create_fix_pr()` with dummy content. Confirm PR appears in GitHub. | Build `ConstitutionPanel.tsx` + `AgentMeshLines.tsx`. | Build `IssueFeed.tsx` with poll. Build `CodeDiffPanel.tsx`. |
| **1:00–1:30** | **Lunch** | **Lunch** | **Lunch** | **Lunch** |
| **1:30–2:30** | Run full graph end-to-end. Tune `fix_generator` prompt until diff is valid Go. | Tune PR body quality. Test Slack webhook if set up. | Build `AgentCommFeed.tsx`. Wire to SSE events. | Build `PRPreviewPanel.tsx` + confetti. Wire all panels to SSE hook. |
| **2:30–4:00** | **Full demo run × 3** with the team. Fix any graph bugs. | Same — confirm PR push is reliable. | Full demo run × 3. Polish animations. | Full demo run × 3. Polish transitions. |
| **4:00–5:00** | Deploy backend to Railway. | Confirm prod GitHub token works. | Deploy frontend to Vercel. | Same. |
| **5:00–6:30** | Record demo video (Loom, 90 sec). Write DevPost description. | | | |
| **6:30–7:00** | Submit DevPost. | | | |

---

## Setup (run at 9:00 AM sharp)

```bash
# 1. Qdrant (Vitthal)
docker run -d -p 6333:6333 qdrant/qdrant

# 2. Backend (Vitthal + Neil — shared terminal)
cd /Users/intern/Desktop/xFoundry/GDSD\ Hack/GDSC-Hackathon/backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# fill in: ANTHROPIC_API_KEY, GITHUB_TOKEN, DEMO_REPO
uvicorn main:app --port 8000 --reload

# 3. Frontend (Avhaang + Mitansh)
cd /Users/intern/Desktop/xFoundry/aubi/cognoxent/apps/aubi-web
npm install
npm run dev   # localhost:3000
```

---

## Environment Variables

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...          # Vitthal gets this
GITHUB_TOKEN=ghp_...                  # Neil sets this — needs repo write access
DEMO_REPO=your-username/AUBI-Demo     # Neil creates this repo

KNOWLEDGE_SERVICE_URL=http://localhost:8002
AGENTS_SERVICE_URL=http://localhost:8000
QDRANT_URL=http://localhost:6333

# Optional (Slack)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
```

---

## Stretch Goals (only if core is done by 3 PM)

- [ ] **Voice trigger** (Avhaang): Web Speech API in browser — say *"auth is broken"* → triggers demo
- [ ] **Constitution diff after fix** (Vitthal): show "Alice's Aubi learned: retry logic issue resolved" with before/after fact display
- [ ] **Slack reply** (Neil): after PR is pushed, post back to Slack channel: *"Fixed — PR #2 open for review"*
- [ ] **Multi-issue queue** (Mitansh): show 3 queued issues in `IssueFeed`, each triggering a separate run
- [ ] **Agent health score** (Avhaang): completeness indicator on each card (how many constitution categories are filled)
