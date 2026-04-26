# AUBI Frontend Implementation Plan

## Current Implementation Status

Status: implemented as a new Next.js frontend in `frontend/`.

Completed:

- Next.js 14 App Router scaffold with TypeScript strict mode.
- Tailwind theme using AUBI design tokens.
- `/agents` page with the SVG agent constitution mesh.
- `/incident` page with terminal input, mini agent map, neural trace timeline, raw event inspector, Slack mockup, postmortem renderer, and memory update strip.
- Mock/demo mode controlled by `NEXT_PUBLIC_DEV_MODE=true`.
- Next.js API proxy routes for backend agents and incidents.
- SSE client hook with EventSource lifecycle cleanup.

Pending polish:

- Add shadcn-generated primitives if the team wants exact shadcn component structure instead of direct Radix primitives.
- Add Playwright visual checks after dependencies are installed.
- Tune responsive behavior for smaller laptop screens if demo hardware is constrained.
- Wire real backend response shapes once the FastAPI stream output is finalized.

## Purpose

The frontend should act as a visual control plane for AUBI. Because the project is backend-heavy, the UI must make the backend behavior legible: incident analysis, ownership routing, agent constitution lookups, streamed LangGraph execution, generated responses, and memory updates should all be visible and inspectable.

The main demo goal is simple: paste an incident, trigger the run, and watch the backend graph light up step by step while agent memory and generated outputs appear live.

## Aesthetic

The product direction is **Mission Control meets Blade Runner**: a cyberpunk operating system for watching a real-time multi-agent backend work.

Design rules:

- Deep navy background, not pure black.
- Page-wide 40px grid overlay.
- Terminal scanlines on incident input.
- Cyan for primary interactive state.
- Amber for routing/warning.
- Red for incident danger.
- Violet for agent querying.
- Emerald for memory/success.
- Subtle glow only where it communicates state.
- Use Syne for headings, JetBrains Mono for terminal/system text, and Inter for readable body copy.
- Avoid a generic SaaS dashboard. This should feel like an incident operations console.

## Recommended Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Radix Dialog/Tabs primitives, compatible with shadcn/ui's underlying approach
- framer-motion
- react-markdown
- remark-gfm
- Native `EventSource` for SSE

Do not use Chart.js, D3, or canvas for the agent map. The current implementation uses pure SVG plus framer-motion.

## Proposed App Structure

```txt
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx
│   │   ├── agents/page.tsx
│   │   ├── incident/page.tsx
│   │   └── api/
│   │       ├── agents/route.ts
│   │       ├── agents/[id]/route.ts
│   │       ├── incidents/run/route.ts
│   │       └── incidents/stream/route.ts
│   ├── components/
│   │   ├── Nav.tsx
│   │   ├── HexGrid.tsx
│   │   ├── HexNode.tsx
│   │   ├── DossierPanel.tsx
│   │   ├── IncidentTerminal.tsx
│   │   ├── NeuralTrace.tsx
│   │   ├── TraceNode.tsx
│   │   ├── SlackMockup.tsx
│   │   ├── PostmortemDoc.tsx
│   │   └── ResponsePanel.tsx
│   ├── hooks/
│   │   ├── useAgents.ts
│   │   └── useIncidentStream.ts
│   ├── lib/
│   │   ├── api.ts
│   │   └── types.ts
├── package.json
├── tailwind.config.ts
├── next.config.mjs
├── postcss.config.mjs
└── tsconfig.json
```

## Primary Views

### `/agents` — The Hive

This page shows the AI developer team as living memory profiles.

Visual elements:

- Pure SVG hex-grid of developer agents.
- Each hex shows avatar, name, role, and a segmented constitution completeness ring.
- Connection lines visualize shared file ownership.
- Animated cyan pulses travel across ownership connections.
- Hover tooltip shows top owned files, primary language, and commit count.
- Click a hex to open a detailed dossier panel.
- Constitution facts grouped by category:
  - `code_ownership`
  - `expertise`
  - `collaboration`
  - `current_focus`
  - `known_issues`
  - `episodes`
- Confidence bars animate per fact.
- Add-agent dialog posts to `/api/agents`.

Backend data:

```txt
GET /agents
GET /agents/{id}
```

### `/incident` — The War Room

This is the main demo screen.

Implemented layout:

```txt
┌─────────────────────┬────────────────────────────────────┐
│ Incident Terminal   │ Neural Trace SSE Timeline           │
│ Trigger Button      │                                    │
│ Mini Agent Map      ├────────────────────────────────────┤
│ Raw Event Inspector │ Slack Response + Postmortem Package │
└─────────────────────┴────────────────────────────────────┘
```

Backend data:

```txt
GET /incidents/stream?incident_text=...
POST /incidents/run
```

The page makes the backend feel alive and understandable through node-specific animations, terminal styling, and streamed state.

## Backend Pipeline Visual

The current pipeline is rendered as a vertical neural trace matching the LangGraph nodes:

```txt
Incident Text
    ↓
Incident Analyzer
    ↓
Ownership Router
    ↓
Agent Querier
    ↓
Response Drafter
    ↓
Memory Updater
```

Each event supports:

```ts
type NodeStatus = "running" | "done" | "error";
```

Implemented visual behavior:

- `running`: animated pulse/spinner
- `done`: green check
- `error`: red warning
- Compact output preview under each node.
- Full raw JSON event list in the left-column inspector.

This is the most important frontend component because it explains the backend-heavy architecture instantly.

## Agent Activity Feed

Render every SSE message as a timeline item.

Expected event format:

```json
{
  "node": "incident_analyzer",
  "status": "done",
  "output": {
    "affected_service": "payment",
    "affected_files": ["billing/"],
    "error_type": "500",
    "urgency": "P1"
  }
}
```

Timeline examples:

```txt
Analyzer detected payment service failure
Router matched billing/ to Alice
Agent Alice returned retry-logic context
Drafter generated Slack response
Memory updater added resolved incident fact
```

Use icons:

- Search icon for analyzer
- Route icon for router
- Bot icon for agent query
- Message icon for drafter
- Database icon for memory updater

## Response Panel

Split the final output into three sections.

### Slack Draft

Render the generated Slack response in a Slack-like message card.

### Postmortem

Render markdown using `react-markdown`.

### Memory Updates

Show chips/cards for updated agents:

```txt
Alice constitution updated
+ resolved_incident
+ payment retry logic context
```

Data source should come from final SSE output, with `POST /incidents/run` as a fallback.

## Data Visualization Goals

The frontend should visualize these backend data surfaces:

1. Incident extraction:
   - affected service
   - error type
   - urgency
   - affected files
2. Ownership routing:
   - file path -> owner agent
   - confidence score
   - fallback owner if no match
3. Agent constitution:
   - facts grouped by category
   - confidence values
   - facts relevant to the current incident highlighted
4. Agent query result:
   - agent name
   - relevant context
   - in-domain indicator
   - what they would say when paged
5. Generated outputs:
   - Slack message
   - postmortem markdown
   - memory update facts
6. Raw backend event inspector:
   - collapsible JSON event list
   - useful for debugging and showing backend richness

## Implementation Phases

### Phase 1: Frontend Scaffold

- Create Next.js app.
- Add Tailwind, shadcn/ui, and lucide icons.
- Add global app shell with navigation:
  - Agents
  - Incident Console
- Configure backend base URL:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### Phase 2: API Client

Create typed API helpers:

```ts
getAgents()
getAgent(id)
runIncident(text)
streamIncident(text, onEvent)
```

Add TypeScript types matching backend outputs.

### Phase 3: Agents Dashboard

Build:

- `AgentCard`
- `ConstitutionPanel`
- `AgentGraph`
- `JsonInspector`

Use:

```txt
GET /agents
GET /agents/{id}
```

### Phase 4: Incident Console

Build:

- Incident textarea.
- Trigger button.
- Cmd/Ctrl + Enter submit.
- Loading state.
- Reset state between runs.
- Sample incident quick-fill buttons.

### Phase 5: SSE Pipeline Visualization

Build:

- `BackendPipeline`
- `AgentActivityFeed`
- SSE event reducer that turns events into visual node state.

This is the centerpiece.

### Phase 6: Output Panels

Build:

- Slack response renderer.
- Postmortem markdown renderer.
- Memory update panel.
- Raw event inspector.

### Phase 7: Demo Polish

Add:

- Mock fallback data when no agents exist.
- Empty states.
- Error banners when backend is offline.
- Animated transitions.
- Auto-scroll timeline.
- Copy Slack message button.

## Sample Incidents

Add quick-fill buttons for reliable demos:

```txt
Payment service 500s started 20 min ago, likely billing retry loop
Auth failures spiking after mobile token refresh deploy
API timeout on checkout, Redis connection pool exhausted
```

## Design Direction

Do not build this like a marketing landing page. Build it like an incident operations console:

- Dense but readable.
- Highly visual backend state.
- Clear pipeline graph.
- Meaningful status colors.
- Every backend step visible.
- Raw data always inspectable.
- Final outputs obvious and copyable.

## Working Decisions

- The strongest demo screen is `/incident`.
- The frontend should favor observability over minimalism.
- SSE events are the primary source of truth during incident execution.
- `POST /incidents/run` can be kept as a fallback for blocking runs or debugging.
- The UI should work even before real GitHub/Qdrant data exists by showing clear empty states or mock fallback demo data.
