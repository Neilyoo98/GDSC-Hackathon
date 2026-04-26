"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AgentCommFeed } from "@/components/aubi/AgentCommFeed";
import { AgentMeshLines } from "@/components/aubi/AgentMeshLines";
import { useAUBIStream } from "@/hooks/useAUBIStream";
import type { AUBIEvent } from "@/lib/types";

const FLOW_NODES = [
  ["issue_reader", "Issue Read"],
  ["ownership_router", "Ownership Found"],
  ["query_agents", "Agents Consulted"],
  ["code_reader", "Code Read"],
  ["fix_generator", "Fix Generated"],
  ["approval_gate", "Approval Ready"],
  ["pr_pusher", "PR Pushed"]
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function eventRecords(events: AUBIEvent[]): Record<string, unknown>[] {
  return events.map((event) => event.data).filter(isRecord);
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
      if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
    }
  }
  return [];
}

export default function DemoPage() {
  const [inputIssueUrl, setInputIssueUrl] = useState("");
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const { events, agentMessages, nodeStatuses, isStreaming, error, reset } = useAUBIStream(issueUrl);
  const hasRun = !!issueUrl || events.length > 0 || agentMessages.length > 0;
  const trimmedIssue = inputIssueUrl.trim();
  const records = useMemo(() => eventRecords(events), [events]);
  const patchDiff = latestString(records, ["patch_diff"]);
  const fixExplanation = latestString(records, ["fix_explanation"]);
  const testOutput = latestString(records, ["test_output"]);
  const testsPassed = latestBoolean(records, ["tests_passed"]);
  const prUrl = latestString(records, ["pr_url"]);
  const issueTitle = latestString(records, ["issue_title"]);
  const owners = latestStringArray(records, ["owner_ids", "owners"]);
  const awaitingApproval = events.some((event) => event.event === "awaiting_approval");

  const visualNodeStatuses = useMemo(() => {
    return Object.fromEntries(
      FLOW_NODES.map(([node], index) => {
        const realStatus = nodeStatuses[node];
        return [node, realStatus ?? "idle"];
      })
    ) as Record<(typeof FLOW_NODES)[number][0], "idle" | "running" | "done">;
  }, [nodeStatuses]);

  const statusText = useMemo(() => {
    if (error) return "Stream Error";
    if (prUrl) return "PR Ready";
    if (awaitingApproval) return "Approval";
    if (isStreaming) return "Incident Active";
    if (hasRun) return "Awaiting Data";
    return "Watching Repo";
  }, [awaitingApproval, error, hasRun, isStreaming, prUrl]);

  const completedCount = useMemo(
    () => FLOW_NODES.filter(([node]) => visualNodeStatuses[node] === "done").length,
    [visualNodeStatuses]
  );

  const progressPercent = Math.round((completedCount / FLOW_NODES.length) * 100);
  const activeMessage = agentMessages.at(-1) ?? null;
  const diffLines = patchDiff.split("\n").filter(Boolean);
  const checkItems = [
    { label: "Issue linked", done: Boolean(issueUrl || latestString(records, ["repo_name"])) },
    { label: "Owner validated", done: owners.length > 0 || visualNodeStatuses.ownership_router === "done" },
    { label: "Patch generated", done: Boolean(patchDiff) },
    { label: "Tests attached", done: typeof testsPassed === "boolean" || Boolean(testOutput) },
  ];

  function runFlow() {
    if (!trimmedIssue || isStreaming) return;
    reset();
    setIssueUrl(null);
    window.setTimeout(() => setIssueUrl(trimmedIssue), 0);
  }

  return (
    <div className="flex h-[calc(100vh-52px)] flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#1f1f1f] bg-[#080808] px-6">
        <div>
          <h1 className="font-syne text-4xl font-normal leading-none text-[#e8e4dc]">AUBI Flow</h1>
          <p className="font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc99]">Issue → Agents Talk → Fix → PR</p>
        </div>
        <div className="flex items-center gap-4">
          <input
            value={inputIssueUrl}
            onChange={(event) => setInputIssueUrl(event.target.value)}
            placeholder="owner/repo#123 or issue URL"
            className="w-[340px] border border-[#e8e4dc33] bg-[#050505] px-3 py-2 font-mono text-xs text-[#e8e4dc] outline-none placeholder:text-[#e8e4dc55]"
          />
          <span className={`border px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] ${isStreaming ? "border-[#39ff14] text-[#39ff14]" : "border-[#e8e4dc33] text-[#e8e4dc99]"}`}>
            {statusText}
          </span>
          <button
            onClick={runFlow}
            aria-disabled={!trimmedIssue || isStreaming}
            className={[
              "relative overflow-hidden border px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[2px] transition-all",
              trimmedIssue && !isStreaming
                ? "border-[#39ff14] text-[#39ff14] hover:bg-[#39ff14] hover:text-[#080808]"
                : "border-[#e8e4dc33] text-[#e8e4dc66]",
            ].join(" ")}
          >
            <span className={isStreaming ? "animate-pulse" : ""}>{isStreaming ? "Running" : "Run AUBI"}</span>
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr] gap-6 p-6">
        <div className="flex min-h-0 flex-col gap-6">
          <AgentMeshLines messages={agentMessages} activeMessage={activeMessage} />
          <AgentCommFeed messages={agentMessages} isStreaming={isStreaming} />
        </div>

        <section className="grid min-h-0 grid-rows-[auto_1fr] gap-6">
          <div className="relative overflow-hidden border border-[#e8e4dc33] bg-[#080808] p-4">
            <div className="absolute inset-x-0 top-0 h-px bg-[#39ff14]" style={{ width: `${Math.max(progressPercent, isStreaming ? 8 : 0)}%` }} />
            <div className="mb-4 flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc99]">{"// GRAPH PROGRESS"}</div>
              <div className="font-mono text-[10px] uppercase tracking-[2px] text-[#39ff14]">{progressPercent}% synced</div>
            </div>
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-7">
              {FLOW_NODES.map(([node, label], index) => {
                const status = visualNodeStatuses[node] ?? "idle";
                return (
                  <motion.div
                    key={node}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className={[
                      "relative min-h-14 overflow-hidden border px-3 py-2 font-mono text-[10px] uppercase tracking-[2px] transition-colors",
                      status === "done"
                        ? "border-[#39ff14] bg-[#39ff1412] text-[#39ff14]"
                        : status === "running"
                          ? "border-[#39ff14] text-[#39ff14]"
                        : "border-[#1f1f1f] text-[#e8e4dc99]"
                    ].join(" ")}
                  >
                    {status === "running" && (
                      <motion.span
                        className="absolute inset-y-0 left-0 w-10 bg-[#39ff1422]"
                        animate={{ x: ["-120%", "760%"] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                      />
                    )}
                    <span className="relative block">{label}</span>
                    <span className="relative mt-2 block text-[8px] text-[#e8e4dc66]">{status}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="grid min-h-0 gap-6 xl:grid-cols-2">
            <section className="flex min-h-0 flex-col overflow-hidden border border-[#e8e4dc33] bg-[#080808]">
              <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#1f1f1f] px-4">
                <p className="font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc99]">{"// CODE DIFF"}</p>
                <span className={`font-mono text-[10px] uppercase tracking-[2px] ${visualNodeStatuses.fix_generator === "done" || visualNodeStatuses.fix_generator === "running" ? "text-[#39ff14]" : "text-[#e8e4dc66]"}`}>
                  {patchDiff ? "Generated" : visualNodeStatuses.fix_generator === "running" ? "Writing" : "Waiting"}
                </span>
              </header>
              <div className="aubi-scrollbar flex-1 overflow-auto p-4 font-mono text-[11px] leading-7">
                {!hasRun && <div className="flex h-full items-center justify-center uppercase tracking-[3px] text-[#e8e4dc66]">Run AUBI to stream a live patch</div>}
                {hasRun && !patchDiff && (
                  <div className="flex h-full items-center justify-center px-8 text-center uppercase tracking-[3px] text-[#e8e4dc66]">
                    {error ?? "Waiting for fix generator output"}
                  </div>
                )}
                {diffLines.map((line, index) => {
                  const sign = line.startsWith("+") ? "+" : line.startsWith("-") ? "-" : " ";
                  return (
                    <motion.div
                      key={`${line}-${index}`}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.12 }}
                      className={sign === "+" ? "text-[#39ff14]" : "text-[#e8e4dc66]"}
                    >
                      <span className="mr-3 text-[#e8e4dc55]">{String(index + 1).padStart(2, "0")}</span>
                      <span className="mr-3">{sign}</span>
                      <span>{line.replace(/^[+-]/, "")}</span>
                    </motion.div>
                  );
                })}
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden border border-[#e8e4dc33] bg-[#080808]">
              <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#1f1f1f] px-4">
                <p className="font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc99]">{"// PR PREVIEW"}</p>
                <span className={`font-mono text-[10px] uppercase tracking-[2px] ${visualNodeStatuses.pr_pusher === "done" ? "text-[#39ff14]" : "text-[#e8e4dc66]"}`}>
                  {prUrl ? "Ready" : awaitingApproval ? "Approval" : "Waiting"}
                </span>
              </header>
              <div className="flex flex-1 flex-col gap-4 p-4">
                <motion.div
                  initial={{ opacity: 0.65 }}
                  animate={{ opacity: hasRun ? 1 : 0.65 }}
                  className="border border-[#1f1f1f] p-4"
                >
                  <p className="mb-2 font-mono text-[9px] uppercase tracking-[3px] text-[#e8e4dc66]">Pull request title</p>
                  <p className="text-sm font-medium text-[#e8e4dc]">
                    {issueTitle ? `Fix ${issueTitle}` : prUrl ? "PR created by AUBI" : awaitingApproval ? "Approval required before PR push" : "Waiting for generated PR"}
                  </p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc66]">{trimmedIssue || "No issue selected"}</p>
                  {prUrl && (
                    <a href={prUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex font-mono text-[10px] uppercase tracking-[2px] text-[#39ff14]">
                      Open PR
                    </a>
                  )}
                  {fixExplanation && <p className="mt-3 text-xs leading-relaxed text-[#e8e4dc99]">{fixExplanation}</p>}
                </motion.div>
                <div className="grid gap-2">
                  {checkItems.map((check, index) => {
                    return (
                      <motion.div
                        key={check.label}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: hasRun ? 1 : 0.4, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between border border-[#1f1f1f] px-3 py-2 font-mono text-[10px] uppercase tracking-[2px]"
                      >
                        <span className={check.done ? "text-[#39ff14]" : "text-[#e8e4dc99]"}>{check.label}</span>
                        <motion.span
                          className={`h-2 w-2 rounded-full ${check.done ? "bg-[#39ff14]" : "bg-[#1f1f1f]"}`}
                          animate={check.done ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                          transition={{ duration: 0.7, repeat: check.done && isStreaming ? Infinity : 0 }}
                        />
                      </motion.div>
                    );
                  })}
                </div>
                {(typeof testsPassed === "boolean" || testOutput) && (
                  <div className="border border-[#1f1f1f] p-3">
                    <p className={`font-mono text-[10px] uppercase tracking-[2px] ${testsPassed ? "text-[#39ff14]" : "text-amber-300"}`}>
                      {typeof testsPassed === "boolean" ? (testsPassed ? "Verification passed" : "Verification failed") : "Verification output"}
                    </p>
                    {testOutput && <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap text-[10px] leading-relaxed text-[#e8e4dc99]">{testOutput}</pre>}
                  </div>
                )}
                <div className="mt-auto border border-[#1f1f1f] p-3">
                  <p className="font-mono text-[9px] uppercase tracking-[3px] text-[#e8e4dc66]">Live stream</p>
                  <div className="mt-3 space-y-2">
                    {(events.length ? events.slice(-4) : [{ event: "idle", data: null }]).map((event, index) => (
                      <motion.div
                        key={`${event.event}-${index}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc99]"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-[#39ff14]" />
                        {event.event.replaceAll("_", " ")}
                      </motion.div>
                    ))}
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
