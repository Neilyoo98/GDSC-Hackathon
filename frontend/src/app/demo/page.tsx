"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AgentCommFeed } from "@/components/aubi/AgentCommFeed";
import { AgentMeshLines } from "@/components/aubi/AgentMeshLines";
import { useAUBIStream } from "@/hooks/useAUBIStream";
import type { AUBIEvent } from "@/lib/types";

const FLOW_NODES = [
  ["issue_reader",     "Issue",     "reading issue"],
  ["ownership_router", "Ownership", "routing owner"],
  ["query_agents",     "Coworkers", "agents consult"],
  ["code_reader",      "Code",      "reading files"],
  ["fix_generator",    "Fix",       "generating patch"],
  ["approval_gate",    "Approve",   "awaiting human"],
  ["pr_pusher",        "PR Push",   "pushing pr"],
] as const;

type FlowNode = (typeof FLOW_NODES)[number][0];

const SAMPLE_ISSUE = "Neilyoo98/GDSC-Hackathon#1";

const DIFF_LINES = [
  { sign: "+", ln: 12, code: "owner, err := store.RouteByConstitution(issue)" },
  { sign: "+", ln: 13, code: "ctx, _ := owner.Agent.Query(issue, repo)" },
  { sign: "-", ln: 14, code: "return slackPing(issue.Title)" },
  { sign: "+", ln: 14, code: "return draftPR(owner, ctx, patch)" },
  { sign: "+", ln: 15, code: "memory.Write(owner.ID, learnedFacts)" },
] as const;

const DEMO_MESSAGES = [
  { sender: "orchestrator", recipient: "alice_aubi",   message: "Issue reader found auth 401 failures in the student submission path. Checking ownership memory." },
  { sender: "alice_aubi",   recipient: "orchestrator", message: "I own auth middleware and recent token validation changes. Pulling context from the constitution." },
  { sender: "orchestrator", recipient: "bob_aubi",     message: "Cross-check payments side effects before fix generation. Need shared context on billing callbacks." },
  { sender: "bob_aubi",     recipient: "orchestrator", message: "No payment callback regression detected. Route fix back to Alice and generate the PR patch." },
];

const EVENT_COLORS: Record<string, string> = {
  node_done:         "#39ff14",
  node_start:        "#e8e4dc66",
  agent_message:     "#a78bfa",
  awaiting_approval: "#fbbf24",
  complete:          "#39ff14",
  error:             "#f87171",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function eventRecords(events: AUBIEvent[]): Record<string, unknown>[] {
  return events.map((e) => e.data).filter(isRecord);
}

function latestString(records: Record<string, unknown>[], keys: string[]): string {
  for (const record of records.slice().reverse()) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return "";
}

function latestBoolean(records: Record<string, unknown>[], keys: string[]): boolean | undefined {
  for (const record of records.slice().reverse()) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "boolean") return value;
    }
  }
  return undefined;
}

function latestStringArray(records: Record<string, unknown>[], keys: string[]): string[] {
  for (const record of records.slice().reverse()) {
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value))
        return value.filter((item): item is string => typeof item === "string");
    }
  }
  return [];
}

export default function DemoPage() {
  const [inputIssueUrl, setInputIssueUrl]       = useState(SAMPLE_ISSUE);
  const [issueUrl, setIssueUrl]                 = useState<string | null>(null);
  const [visualStep, setVisualStep]             = useState(0);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [threadId, setThreadId]                 = useState<string | null>(null);
  const [approving, setApproving]               = useState(false);
  const [prUrl, setPrUrl]                       = useState<string | null>(null);
  const [elapsed, setElapsed]                   = useState(0);
  const startTimeRef                            = useRef<number | null>(null);

  const { events, agentMessages, nodeStatuses, isStreaming, isVisualReplay, reset } =
    useAUBIStream(issueUrl);

  const hasRun       = !!issueUrl || events.length > 0 || agentMessages.length > 0;
  const trimmedIssue = inputIssueUrl.trim();
  const isDone       = !!(prUrl || nodeStatuses.pr_pusher === "done");

  // ── derived data from real backend events ────────────────────────────────
  const records      = useMemo(() => eventRecords(events), [events]);
  const patchDiff    = latestString(records, ["patch_diff"]);
  const fixExplanation = latestString(records, ["fix_explanation"]);
  const testOutput   = latestString(records, ["test_output"]);
  const testsPassed  = latestBoolean(records, ["tests_passed"]);
  const issueTitle   = latestString(records, ["issue_title"]);
  const owners       = latestStringArray(records, ["owner_ids", "owners"]);

  // ── visual step ticker ───────────────────────────────────────────────────
  useEffect(() => {
    if (!hasRun) { setVisualStep(0); return; }
    const id = window.setInterval(
      () => setVisualStep((c) => Math.min(FLOW_NODES.length, c + 1)),
      isStreaming ? 700 : 850
    );
    return () => window.clearInterval(id);
  }, [hasRun, isStreaming, issueUrl]);

  // ── elapsed timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isStreaming) return;
    if (startTimeRef.current === null) startTimeRef.current = Date.now();
    const id = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - (startTimeRef.current ?? Date.now())) / 1000)),
      1000
    );
    return () => window.clearInterval(id);
  }, [isStreaming]);

  // ── detect approval / completion from SSE events ─────────────────────────
  useEffect(() => {
    const last = events.at(-1);
    if (!last) return;

    if (last.event === "awaiting_approval") {
      if (last.data.mode !== "visual_replay") {
        setAwaitingApproval(true);
        const tid = last.data.thread_id;
        if (typeof tid === "string") setThreadId(tid);
      }
    }
    if (last.event === "complete") {
      setAwaitingApproval(false);
      const url = last.data?.pr_url;
      if (typeof url === "string" && url !== "visual-preview") setPrUrl(url);
    }
    if (last.event === "node_done" && last.node === "pr_pusher") {
      const url = last.data?.pr_url;
      if (typeof url === "string" && url !== "visual-preview") setPrUrl(url);
    }
  }, [events]);

  // ── approve handler ──────────────────────────────────────────────────────
  const handleApprove = useCallback(async () => {
    if (!threadId || approving) return;
    setApproving(true);
    try {
      const res = await fetch(
        `/api/incidents/approve?thread_id=${encodeURIComponent(threadId)}&approved=true`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      const url = data.pr_url;
      if (typeof url === "string") setPrUrl(url);
      setAwaitingApproval(false);
    } finally {
      setApproving(false);
    }
  }, [approving, threadId]);

  // ── visual node statuses (real backend + animated fallback) ──────────────
  const visualNodeStatuses = useMemo(() => {
    return Object.fromEntries(
      FLOW_NODES.map(([node], index) => {
        const real     = nodeStatuses[node];
        const fallback = !hasRun
          ? "idle"
          : index < visualStep
          ? "done"
          : index === visualStep
          ? "running"
          : "idle";
        return [node, real ?? fallback];
      })
    ) as Record<FlowNode, "idle" | "running" | "done">;
  }, [hasRun, nodeStatuses, visualStep]);

  const completedCount = useMemo(
    () => FLOW_NODES.filter(([n]) => visualNodeStatuses[n] === "done").length,
    [visualNodeStatuses]
  );
  const progressPercent = Math.round((completedCount / FLOW_NODES.length) * 100);

  const statusText = useMemo(() => {
    if (isDone)           return "Fixed";
    if (awaitingApproval) return "Approve";
    if (isStreaming)      return "Running";
    if (hasRun)           return isVisualReplay ? "Demo" : "Done";
    return "Ready";
  }, [awaitingApproval, hasRun, isDone, isStreaming, isVisualReplay]);

  const checkItems = useMemo(() => [
    { label: "Issue linked",    done: Boolean(issueUrl || latestString(records, ["repo_name"])) },
    { label: "Owner validated", done: owners.length > 0 || visualNodeStatuses.ownership_router === "done" },
    { label: "Patch generated", done: Boolean(patchDiff) || visualNodeStatuses.fix_generator === "done" },
    { label: "Tests attached",  done: typeof testsPassed === "boolean" || Boolean(testOutput) || isDone },
  ], [isDone, issueUrl, owners.length, patchDiff, records, testOutput, testsPassed, visualNodeStatuses]);

  const displayMessages = agentMessages.length > 0
    ? agentMessages
    : DEMO_MESSAGES.slice(0, hasRun ? Math.max(1, Math.min(DEMO_MESSAGES.length, visualStep + 1)) : 2);

  const activeMessage =
    agentMessages.at(-1) ?? DEMO_MESSAGES[visualStep % DEMO_MESSAGES.length];

  // real patchDiff from backend, else static DIFF_LINES for demo
  const diffLines = patchDiff
    ? patchDiff.split("\n").filter(Boolean).map((line, i) => ({
        sign: line.startsWith("+") ? "+" : line.startsWith("-") ? "-" : " ",
        ln: i + 1,
        code: line.replace(/^[+-]/, ""),
      }))
    : DIFF_LINES;

  function runFlow() {
    if (!trimmedIssue || isStreaming) return;
    reset();
    setVisualStep(0);
    setAwaitingApproval(false);
    setThreadId(null);
    setPrUrl(null);
    setElapsed(0);
    startTimeRef.current = null;
    setIssueUrl(null);
    window.setTimeout(() => setIssueUrl(trimmedIssue), 0);
  }

  return (
    <div className="flex h-[calc(100vh-52px)] flex-col overflow-hidden bg-[#080808]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#1f1f1f] px-6">
        <div className="flex flex-col leading-none">
          <h1 className="font-syne text-[20px] font-normal tracking-[4px] text-[#e8e4dc]">
            AUBI Flow
          </h1>
          <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[3px] text-[#e8e4dc44]">
            Issue → Agents → Fix → PR
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* issue input */}
          <input
            value={inputIssueUrl}
            onChange={(e) => setInputIssueUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runFlow()}
            placeholder="owner/repo#123 or full issue URL"
            className="w-[300px] border border-[#e8e4dc1a] bg-transparent px-3 py-[7px] font-mono text-[11px] text-[#e8e4dc] outline-none transition-colors placeholder:text-[#e8e4dc33] focus:border-[#e8e4dc44]"
          />

          {/* status pill */}
          <motion.div
            key={statusText}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={[
              "flex items-center gap-1.5 border px-2.5 py-[5px] font-mono text-[9px] uppercase tracking-[2px] transition-all duration-300",
              isDone
                ? "border-[#39ff14] text-[#39ff14]"
                : awaitingApproval
                ? "border-amber-400 text-amber-400"
                : isStreaming
                ? "border-[#39ff14] text-[#39ff14]"
                : hasRun
                ? "border-[#e8e4dc22] text-[#e8e4dc66]"
                : "border-[#e8e4dc11] text-[#e8e4dc33]",
            ].join(" ")}
          >
            {(isStreaming || awaitingApproval) && (
              <span
                className={`h-1.5 w-1.5 rounded-full animate-pulse ${
                  awaitingApproval ? "bg-amber-400" : "bg-[#39ff14]"
                }`}
              />
            )}
            {statusText}
          </motion.div>

          {/* approve button (header) */}
          <AnimatePresence>
            {awaitingApproval && (
              <motion.button
                initial={{ opacity: 0, scale: 0.94, x: 6 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.94, x: 6 }}
                transition={{ duration: 0.18 }}
                onClick={() => void handleApprove()}
                disabled={approving}
                className="relative overflow-hidden border border-amber-400 bg-amber-400 px-4 py-[7px] font-mono text-[10px] font-semibold uppercase tracking-[2px] text-[#080808] transition-colors hover:bg-amber-300 disabled:opacity-50"
              >
                <motion.span
                  className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-white/25"
                  animate={{ x: ["-100%", "900%"] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                />
                <span className="relative">
                  {approving ? "Pushing…" : "Approve PR →"}
                </span>
              </motion.button>
            )}
          </AnimatePresence>

          {/* PR link */}
          <AnimatePresence>
            {prUrl && (
              <motion.a
                initial={{ opacity: 0, scale: 0.94, x: 6 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                href={prUrl}
                target="_blank"
                rel="noreferrer"
                className="border border-[#39ff14] bg-[#39ff14] px-4 py-[7px] font-mono text-[10px] font-semibold uppercase tracking-[2px] text-[#080808] transition-colors hover:bg-[#39ff14cc]"
              >
                Open PR →
              </motion.a>
            )}
          </AnimatePresence>

          {/* run button */}
          <button
            onClick={runFlow}
            disabled={!trimmedIssue || isStreaming}
            className={[
              "relative overflow-hidden border px-4 py-[7px] font-mono text-[10px] font-semibold uppercase tracking-[2px] transition-all disabled:cursor-not-allowed",
              trimmedIssue && !isStreaming
                ? "border-[#39ff14] text-[#39ff14] hover:bg-[#39ff14] hover:text-[#080808]"
                : "border-[#e8e4dc11] text-[#e8e4dc33]",
            ].join(" ")}
          >
            {isStreaming ? (
              <>
                <motion.span
                  className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-[#39ff14]/10"
                  animate={{ x: ["-100%", "800%"] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                />
                <span className="relative">Running…</span>
              </>
            ) : (
              "Run AUBI"
            )}
          </button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr]">

        {/* ── Left column ─────────────────────────────────────────────── */}
        <aside className="flex min-h-0 flex-col border-r border-[#1f1f1f]">
          <AgentMeshLines messages={displayMessages} activeMessage={activeMessage} />
          <div className="min-h-0 flex-1">
            <AgentCommFeed messages={displayMessages} isStreaming={isStreaming} />
          </div>
        </aside>

        {/* ── Right column ────────────────────────────────────────────── */}
        <section className="flex min-h-0 flex-col">

          {/* Pipeline progress ──────────────────────────────────────── */}
          <div className="relative shrink-0 border-b border-[#1f1f1f] px-5 pb-5 pt-4">
            {/* thin progress bar */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-[#1f1f1f]">
              <motion.div
                className="h-full bg-[#39ff14]"
                style={{ boxShadow: "0 0 6px #39ff1499" }}
                animate={{ width: `${Math.max(progressPercent, isStreaming ? 3 : 0)}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            </div>

            {/* header row */}
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[8px] uppercase tracking-[3px] text-[#e8e4dc44]">
                {"// graph progress"}
              </span>
              <div className="flex items-center gap-4">
                {isStreaming && elapsed > 0 && (
                  <span className="font-mono text-[9px] tabular-nums text-[#e8e4dc33]">
                    {elapsed}s
                  </span>
                )}
                {isVisualReplay && (
                  <span className="border border-[#e8e4dc1a] px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[2px] text-[#e8e4dc33]">
                    demo replay
                  </span>
                )}
                <span className="font-mono text-[9px] uppercase tracking-[2px] text-[#39ff14]">
                  {progressPercent}% synced
                </span>
              </div>
            </div>

            {/* nodes */}
            <div className="grid grid-cols-7 gap-2">
              {FLOW_NODES.map(([node, label, subtitle], index) => {
                const status          = visualNodeStatuses[node] ?? "idle";
                const isApproval      = node === "approval_gate";
                const approvalPending = isApproval && awaitingApproval;
                const approvalDone    = isApproval && (isDone || status === "done");

                return (
                  <motion.div
                    key={node}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.035, ease: "easeOut" }}
                    className={[
                      "relative flex flex-col gap-1 overflow-hidden border px-2.5 py-2.5 transition-all duration-400",
                      approvalPending
                        ? "border-amber-400 shadow-[0_0_16px_#f59e0b22]"
                        : status === "done"
                        ? "border-[#39ff14] bg-[#39ff1405]"
                        : status === "running"
                        ? "border-[#39ff14] shadow-[0_0_16px_#39ff1422]"
                        : "border-[#1f1f1f]",
                    ].join(" ")}
                  >
                    {status === "running" && (
                      <motion.span
                        className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-transparent via-[#39ff14]/12 to-transparent"
                        animate={{ x: ["-100%", "700%"] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      />
                    )}

                    <AnimatePresence>
                      {(status === "done" || approvalDone) && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className={[
                            "absolute right-2 top-1.5 font-mono text-[9px] font-bold",
                            approvalPending ? "text-amber-400" : "text-[#39ff14]",
                          ].join(" ")}
                        >
                          ✓
                        </motion.span>
                      )}
                    </AnimatePresence>

                    <span className="font-mono text-[7px] leading-none text-[#e8e4dc1a]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={[
                        "font-mono text-[9px] uppercase leading-tight tracking-[1px]",
                        approvalPending
                          ? "text-amber-400"
                          : status !== "idle"
                          ? "text-[#e8e4dc]"
                          : "text-[#e8e4dc44]",
                      ].join(" ")}
                    >
                      {label}
                    </span>
                    <span
                      className={[
                        "font-mono text-[7.5px] leading-tight",
                        approvalPending
                          ? "text-amber-300"
                          : status === "done"
                          ? "text-[#39ff14]"
                          : status === "running"
                          ? "text-[#39ff14]"
                          : "text-[#e8e4dc22]",
                      ].join(" ")}
                    >
                      {status === "running" ? subtitle : status === "done" ? "done" : "idle"}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* ── Bottom panels ─────────────────────────────────────────── */}
          <div className="grid min-h-0 flex-1 grid-cols-2">

            {/* Code diff ─────────────────────────────────────────────── */}
            <section className="flex min-h-0 flex-col border-r border-[#1f1f1f]">
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#1f1f1f] px-4">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[8px] uppercase tracking-[3px] text-[#e8e4dc44]">
                    {"// code diff"}
                  </span>
                  <span className="font-mono text-[9px] text-[#e8e4dc22]">
                    {patchDiff ? "live patch" : "auth/token.go"}
                  </span>
                </div>
                <motion.span
                  key={String(visualNodeStatuses.fix_generator)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={[
                    "font-mono text-[9px] uppercase tracking-[2px]",
                    visualNodeStatuses.fix_generator !== "idle"
                      ? "text-[#39ff14]"
                      : "text-[#e8e4dc22]",
                  ].join(" ")}
                >
                  {visualNodeStatuses.fix_generator === "done"
                    ? "generated"
                    : visualNodeStatuses.fix_generator === "running"
                    ? "writing…"
                    : "waiting"}
                </motion.span>
              </div>

              <div className="aubi-scrollbar flex-1 overflow-auto p-4">
                {!hasRun ? (
                  <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc22]">
                    Run flow to stream patch
                  </div>
                ) : (
                  <div className="space-y-0.5 font-mono text-[11px] leading-7">
                    {diffLines.map(({ sign, ln, code }, i) => {
                      const isActive =
                        visualNodeStatuses.fix_generator === "done" ||
                        visualNodeStatuses.fix_generator === "running" ||
                        i < completedCount;
                      const added   = sign === "+";
                      const removed = sign === "-";

                      return (
                        <motion.div
                          key={`${sign}-${i}`}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: isActive ? 1 : 0.15, x: 0 }}
                          transition={{ delay: i * 0.09, ease: "easeOut" }}
                          className={[
                            "flex items-baseline gap-0 rounded-sm px-1",
                            isActive && added   ? "bg-[#39ff14]/[0.04]" : "",
                            isActive && removed ? "bg-red-500/[0.04]"   : "",
                          ].join(" ")}
                        >
                          <span className="w-6 shrink-0 select-none text-right text-[#e8e4dc1a]">
                            {ln}
                          </span>
                          <span
                            className={[
                              "w-5 shrink-0 select-none text-center",
                              added   ? "text-[#39ff14]"  : "",
                              removed ? "text-red-400/50" : "",
                            ].join(" ")}
                          >
                            {sign}
                          </span>
                          <span
                            className={
                              removed
                                ? "text-[#e8e4dc]/25 line-through decoration-red-400/40"
                                : added
                                ? "text-[#e8e4dc]"
                                : "text-[#e8e4dc]/50"
                            }
                          >
                            {code}
                          </span>
                        </motion.div>
                      );
                    })}

                    {visualNodeStatuses.fix_generator === "running" && (
                      <motion.div
                        className="flex items-baseline gap-0 px-1"
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.85, repeat: Infinity }}
                      >
                        <span className="w-6 shrink-0 select-none text-right text-[#e8e4dc1a]">
                          {diffLines.length + 1}
                        </span>
                        <span className="w-5 shrink-0 select-none text-center text-[#39ff14]">+</span>
                        <span className="text-[#39ff14]">▋</span>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* PR preview ─────────────────────────────────────────────── */}
            <section className="flex min-h-0 flex-col">
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#1f1f1f] px-4">
                <span className="font-mono text-[8px] uppercase tracking-[3px] text-[#e8e4dc44]">
                  {"// pr preview"}
                </span>
                <motion.span
                  key={isDone ? "merged" : awaitingApproval ? "approve" : "drafting"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={[
                    "font-mono text-[9px] uppercase tracking-[2px]",
                    isDone
                      ? "text-[#39ff14]"
                      : awaitingApproval
                      ? "text-amber-400"
                      : "text-[#e8e4dc22]",
                  ].join(" ")}
                >
                  {isDone ? "merged" : awaitingApproval ? "approve" : "drafting"}
                </motion.span>
              </div>

              <div className="aubi-scrollbar flex flex-1 flex-col gap-3 overflow-auto p-4">
                {/* PR title */}
                <motion.div
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: hasRun ? 1 : 0.4 }}
                  className="border border-[#1f1f1f] p-3"
                >
                  <p className="font-mono text-[7.5px] uppercase tracking-[3px] text-[#e8e4dc33]">
                    pull request
                  </p>
                  <p className="mt-1.5 text-[13px] font-medium leading-snug text-[#e8e4dc]">
                    {issueTitle ? `Fix: ${issueTitle}` : "Fix: route issue with AUBI-generated patch"}
                  </p>
                  <p className="mt-1 font-mono text-[9px] text-[#e8e4dc33]">
                    {trimmedIssue || SAMPLE_ISSUE}
                  </p>
                  {fixExplanation && (
                    <p className="mt-2 text-[11px] leading-relaxed text-[#e8e4dc99]">
                      {fixExplanation}
                    </p>
                  )}
                </motion.div>

                {/* checks */}
                <div className="space-y-1.5">
                  {checkItems.map((check, i) => (
                    <motion.div
                      key={check.label}
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: hasRun ? 1 : 0.3, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="flex items-center justify-between border border-[#1f1f1f] px-3 py-2"
                    >
                      <span
                        className={[
                          "font-mono text-[10px] uppercase tracking-[1.5px] transition-colors duration-300",
                          check.done ? "text-[#39ff14]" : "text-[#e8e4dc44]",
                        ].join(" ")}
                      >
                        {check.label}
                      </span>
                      <AnimatePresence mode="wait">
                        {check.done ? (
                          <motion.span
                            key="tick"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ type: "spring", stiffness: 350, damping: 22 }}
                            className="font-mono text-[10px] font-bold text-[#39ff14]"
                          >
                            ✓
                          </motion.span>
                        ) : (
                          <motion.span
                            key="dot"
                            className="h-1.5 w-1.5 rounded-full bg-[#1f1f1f]"
                          />
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>

                {/* test output (when backend provides it) */}
                {(typeof testsPassed === "boolean" || testOutput) && (
                  <div className="border border-[#1f1f1f] p-3">
                    <p
                      className={`font-mono text-[10px] uppercase tracking-[2px] ${
                        testsPassed ? "text-[#39ff14]" : "text-amber-300"
                      }`}
                    >
                      {typeof testsPassed === "boolean"
                        ? testsPassed
                          ? "Verification passed"
                          : "Verification failed"
                        : "Verification output"}
                    </p>
                    {testOutput && (
                      <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap text-[10px] leading-relaxed text-[#e8e4dc99]">
                        {testOutput}
                      </pre>
                    )}
                  </div>
                )}

                {/* approve button (in panel) */}
                <AnimatePresence>
                  {awaitingApproval && !prUrl && (
                    <motion.button
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => void handleApprove()}
                      disabled={approving}
                      className="relative w-full overflow-hidden border border-amber-400 py-3 font-mono text-[10px] font-semibold uppercase tracking-[2px] text-amber-400 transition-all hover:bg-amber-400 hover:text-[#080808] disabled:opacity-50"
                    >
                      <motion.span
                        className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-amber-400/15"
                        animate={{ x: ["-100%", "1100%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      />
                      <span className="relative">
                        {approving ? "Pushing PR…" : "Approve PR Push →"}
                      </span>
                    </motion.button>
                  )}
                </AnimatePresence>

                {/* PR link */}
                <AnimatePresence>
                  {prUrl && (
                    <motion.a
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      href={prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center border border-[#39ff14] bg-[#39ff14] py-3 font-mono text-[10px] font-semibold uppercase tracking-[2px] text-[#080808] transition-colors hover:bg-[#39ff14cc]"
                    >
                      Open PR on GitHub →
                    </motion.a>
                  )}
                </AnimatePresence>

                {/* live event stream */}
                <div className="mt-auto border border-[#1f1f1f] p-3">
                  <p className="font-mono text-[7.5px] uppercase tracking-[3px] text-[#e8e4dc33]">
                    {"// events"}
                  </p>
                  <div className="mt-2.5 space-y-1.5">
                    {events.length === 0 ? (
                      <p className="font-mono text-[9px] text-[#e8e4dc1a]">
                        Waiting for stream…
                      </p>
                    ) : (
                      events.slice(-5).map((event, i) => (
                        <motion.div
                          key={`${event.event}-${i}`}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[1.5px] text-[#e8e4dc44]"
                        >
                          <span
                            className="h-1 w-1 shrink-0 rounded-full"
                            style={{ backgroundColor: EVENT_COLORS[event.event] ?? "#e8e4dc33" }}
                          />
                          {event.event.replaceAll("_", " ")}
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
