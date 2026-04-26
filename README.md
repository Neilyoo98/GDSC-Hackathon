<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:6366f1,100:8b5cf6&height=220&section=header&text=AUBI&fontSize=90&fontColor=ffffff&fontAlignY=38&desc=Autonomous%20Understanding%20%26%20Behavior%20Inference&descAlignY=58&descSize=22&descColor=c4b5fd" width="100%"/>

<br/>

[![Python](https://img.shields.io/badge/Python-3.11-6366f1?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-8b5cf6?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![LangGraph](https://img.shields.io/badge/LangGraph-Orchestration-a78bfa?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-7c3aed?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Qdrant](https://img.shields.io/badge/Qdrant-Vector%20Memory-6d28d9?style=for-the-badge&logo=qdrant&logoColor=white)](https://qdrant.tech)

[![Gemini](https://img.shields.io/badge/Gemini%202.0%20Flash-Constitution%20Builder-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/gemini)
[![Claude](https://img.shields.io/badge/Claude%20Haiku-Agent%20Queries-D97706?style=for-the-badge&logo=anthropic&logoColor=white)](https://anthropic.com)
[![GPT](https://img.shields.io/badge/GPT--5.5-Fix%20Generator-10B981?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)

<br/>

### *AI that knows your team — not just your codebase.*

**Autonomous Understanding & Behavior Inference**

**GDSC Hackathon 2026 · University of Maryland · April 26**

🏆 Best App for Developer Productivity &nbsp;·&nbsp; Most Creative &nbsp;·&nbsp; Best Use of Gemini

</div>

---

## The Problem

Every AI coding tool today — Copilot Workspace, OpenHands, SWE-agent — answers the same question: *"How do I fix this?"*

None of them answer: *"Who on the team already knows why this is broken?"*

When a bug lands, the real bottleneck isn't writing the patch. It's finding the one developer who touched that code three months ago, knows about the race condition they never had time to fix, and understands the tradeoffs. That context lives in Slack threads, code comments, and developer memory — not in any tool.

**AUBI solves this.** It builds a persistent memory of every developer's expertise, ownership, and tribal knowledge — then routes bugs to the right AI agent, generates a verified fix with full context, and hands it to a human for one-click approval.

---

## How It Works

A professor opens a GitHub issue: *"Auth endpoint returning 401 — blocking student submissions."*

AUBI takes it from there.

**1 — Issue lands**
AUBI reads the issue, identifies the affected files (`auth/token.go`), and kicks off the LangGraph pipeline.

**2 — Ownership routing**
Qdrant semantic search matches the file path against each developer's Context Constitution. Alice owns `auth/` with 0.95 confidence. Her constitution also flags a *known issue: token cache race condition under concurrent load.* AUBI routes to Alice's agent.

**3 — Agents confer**
Alice's Aubi surfaces the race condition context. Bob's Aubi flags that his recent PR touched adjacent middleware. The Orchestrator synthesizes both. Every message streams live to the frontend — judges see the agents actually reasoning together.

**4 — Fix generated**
GPT-5.5 reads the live file from GitHub and generates a Go mutex patch. The diff renders syntax-highlighted in the UI. A checklist confirms: ownership matched, memory found, patch generated, tests passed.

**5 — Human approves**
AUBI pauses. A human clicks **Approve Alice's PR**. A real GitHub PR appears — written in Alice's communication style, Bob listed as reviewer, issue linked.

**6 — AUBI remembers**
Alice's constitution is updated: the race condition is marked resolved. The episode is stored in Qdrant. Next time a similar issue lands, AUBI already knows.

---

## What Makes This Different

| | Copilot Workspace | SWE-agent | **AUBI** |
|---|---|---|---|
| Generates code | ✅ | ✅ | ✅ |
| Opens PRs automatically | ✅ | ✅ | ✅ |
| Knows *who* owns the bug | ❌ | ❌ | ✅ |
| Surfaces tribal knowledge | ❌ | ❌ | ✅ |
| Learns from each fix | ❌ | ❌ | ✅ |
| Human-in-the-loop approval | ❌ | ❌ | ✅ |
| Writes PRs in developer's voice | ❌ | ❌ | ✅ |

The differentiation is not codegen. **It's team memory + ownership routing + developer-specific context.**

---

## Context Constitution

The heart of AUBI. Built by Gemini 2.0 Flash from a developer's GitHub history — commits, PRs, issues, review patterns — and stored as structured semantic facts in Qdrant.

```
Alice Chen — Context Constitution
─────────────────────────────────────────────────────
Code Ownership     auth/           confidence: 0.95
                   billing/        confidence: 0.87

Expertise          Go · distributed systems · OAuth2

Current Focus      payment/auth retry refactor

Known Issues       ⚠ race condition in TokenCache under concurrent load
                   ⚠ billing retry loop not idempotent in edge cases

Collaboration      direct communicator · prefers async review
Style              writes detailed PR descriptions · tags reviewers early
```

Each fact has a confidence score. Known issues are highlighted in amber — this is what routes bugs to the right person even before the code is read.

---

## Architecture

```
  GitHub Issue
       │
  ┌────▼─────────────────────────────────┐
  │            AUBI Graph                 │
  │                                       │
  │  issue_reader    ── Haiku             │  extract affected files + intent
  │       ↓                               │
  │  ownership_router ── Qdrant           │  semantic match → find owner agent
  │       ↓                               │
  │  query_agents ║  ── Haiku × N         │  parallel: each agent surfaces context
  │       ↓                               │
  │  code_reader    ── GitHub API         │  read live file contents
  │       ↓                               │
  │  fix_generator  ── GPT-5.5            │  generate patch + explanation
  │       ↓                               │
  │  approval_gate  ⏸ ── SSE → frontend  │  pause: human reviews diff
  │       ↓  (on approve)                 │
  │  pr_pusher      ── GitHub API         │  push branch, open real PR
  └───────────────────────────────────────┘
         │                    │
    Alice's Aubi          Bob's Aubi         ← Haiku + constitution per agent
    (Qdrant facts)        (Qdrant facts)
```

**Stack:**
- **LangGraph** — 6-node stateful graph with interrupt/resume for human approval
- **Qdrant** — vector store for semantic facts and episode memory
- **Gemini 2.0 Flash** — structured constitution building from GitHub history
- **GPT-5.5** — code analysis and fix generation
- **Claude Haiku** — per-agent constitution queries and PR writing
- **FastAPI + SSE** — real-time event stream to frontend
- **Next.js 16 + Tailwind + shadcn/ui** — live dashboard

---

## The UI

Three panels, live-updating via SSE:

**Agent Comm Feed** — watch the agents actually talk. Orchestrator → Alice → Bob → fix. Not a log — a conversation, with typing indicators and mesh line animations between agent cards.

**Why Alice?** — a structured routing evidence panel that appears when the owner is identified. File path, confidence score, matched constitution facts. Judges see exactly why AUBI picked her.

**Approve PR** — a checklist that fills in as the graph runs, then surfaces a single big button. One click pushes a real PR to GitHub. The demo ends with a live GitHub link.

---

## Tech Stack

```
Backend          FastAPI · LangGraph · Qdrant · Python 3.11
AI Models        Gemini 2.0 Flash · GPT-5.5 · Claude Haiku
Frontend         Next.js 16 · Tailwind CSS 4 · shadcn/ui · framer-motion
GitHub           PyGithub — issue reading, file fetching, PR creation
Memory           Qdrant — semantic facts + episode storage per developer
Streaming        Server-Sent Events (SSE) — real-time graph node updates
```

---

## Team

Built in 12 hours by four UMD students.

**Vitthal Agarwal** · **Neil** · **Avhaang** · **Mitansh**

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:8b5cf6,100:6366f1&height=120&section=footer" width="100%"/>

*Built in 12 hours at GDSC Hackathon 2026 · University of Maryland*

</div>
