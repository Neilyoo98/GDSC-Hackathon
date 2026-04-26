"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AgentCommFeed } from "@/components/aubi/AgentCommFeed";
import { AgentMeshLines } from "@/components/aubi/AgentMeshLines";
import { useAUBIStream } from "@/hooks/useAUBIStream";

const SAMPLE_ISSUE = "Neilyoo98/GDSC-Hackathon#1";

const FLOW_NODES = [
  ["issue_reader", "Issue Read"],
  ["ownership_router", "Ownership Found"],
  ["query_agents", "Agents Consulted"],
  ["code_reader", "Code Read"],
  ["fix_generator", "Fix Generated"],
  ["approval_gate", "Approval Ready"],
  ["pr_pusher", "PR Pushed"]
] as const;

const DIFF_LINES = [
  ["+", "const owner = await aubi.route(issue, constitutionStore);"],
  ["+", "const context = await owner.agent.query({ issue, repo });"],
  ["-", "return genericSlackPing(issue);"],
  ["+", "return draftFixPullRequest({ owner, context, patch });"],
  ["+", "await memory.write(owner.id, learnedFacts);"]
] as const;

const PR_CHECKS = ["Issue linked", "Owner validated", "Patch generated", "Tests attached"] as const;

export default function DemoPage() {
  const [inputIssueUrl, setInputIssueUrl] = useState(SAMPLE_ISSUE);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const [visualStep, setVisualStep] = useState(0);
  const { events, agentMessages, nodeStatuses, isStreaming, reset } = useAUBIStream(issueUrl);
  const activeMessage = agentMessages.at(-1) ?? null;
  const hasRun = !!issueUrl || events.length > 0 || agentMessages.length > 0;
  const trimmedIssue = inputIssueUrl.trim();

  useEffect(() => {
    if (!hasRun) {
      setVisualStep(0);
      return;
    }

    const timer = window.setInterval(() => {
      setVisualStep((current) => Math.min(FLOW_NODES.length, current + 1));
    }, isStreaming ? 700 : 850);

    return () => window.clearInterval(timer);
  }, [hasRun, isStreaming, issueUrl]);

  const visualNodeStatuses = useMemo(() => {
    return Object.fromEntries(
      FLOW_NODES.map(([node], index) => {
        const realStatus = nodeStatuses[node];
        const fallbackStatus =
          !hasRun ? "idle" : index < visualStep ? "done" : index === visualStep ? "running" : "idle";
        return [node, realStatus ?? fallbackStatus];
      })
    ) as Record<(typeof FLOW_NODES)[number][0], "idle" | "running" | "done">;
  }, [hasRun, nodeStatuses, visualStep]);

  const statusText = useMemo(() => {
    if (visualNodeStatuses.pr_pusher === "done") return "Fixed";
    if (isStreaming) return "Incident Active";
    if (hasRun) return "Visual Replay";
    return "Watching Repo";
  }, [hasRun, isStreaming, visualNodeStatuses]);

  const completedCount = useMemo(
    () => FLOW_NODES.filter(([node]) => visualNodeStatuses[node] === "done").length,
    [visualNodeStatuses]
  );

  const progressPercent = Math.round((completedCount / FLOW_NODES.length) * 100);

  function runFlow() {
    if (!trimmedIssue || isStreaming) return;
    reset();
    setVisualStep(0);
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
                  {visualNodeStatuses.fix_generator === "done" ? "Generated" : visualNodeStatuses.fix_generator === "running" ? "Writing" : "Waiting"}
                </span>
              </header>
              <div className="aubi-scrollbar flex-1 overflow-auto p-4 font-mono text-[11px] leading-7">
                {!hasRun && <div className="flex h-full items-center justify-center uppercase tracking-[3px] text-[#e8e4dc66]">Run the flow to stream a patch</div>}
                {hasRun && DIFF_LINES.map(([sign, text], index) => {
                  const active = visualNodeStatuses.fix_generator === "running" || visualNodeStatuses.fix_generator === "done" || index < completedCount;
                  return (
                    <motion.div
                      key={text}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: active ? 1 : 0.25, x: 0 }}
                      transition={{ delay: index * 0.12 }}
                      className={sign === "+" ? "text-[#39ff14]" : "text-[#e8e4dc66]"}
                    >
                      <span className="mr-3 text-[#e8e4dc55]">{String(index + 1).padStart(2, "0")}</span>
                      <span className="mr-3">{sign}</span>
                      <span>{text}</span>
                    </motion.div>
                  );
                })}
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden border border-[#e8e4dc33] bg-[#080808]">
              <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#1f1f1f] px-4">
                <p className="font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc99]">{"// PR PREVIEW"}</p>
                <span className={`font-mono text-[10px] uppercase tracking-[2px] ${visualNodeStatuses.pr_pusher === "done" ? "text-[#39ff14]" : "text-[#e8e4dc66]"}`}>
                  {visualNodeStatuses.pr_pusher === "done" ? "Ready" : "Drafting"}
                </span>
              </header>
              <div className="flex flex-1 flex-col gap-4 p-4">
                <motion.div
                  initial={{ opacity: 0.65 }}
                  animate={{ opacity: hasRun ? 1 : 0.65 }}
                  className="border border-[#1f1f1f] p-4"
                >
                  <p className="mb-2 font-mono text-[9px] uppercase tracking-[3px] text-[#e8e4dc66]">Pull request title</p>
                  <p className="text-sm font-medium text-[#e8e4dc]">Fix routed issue with AUBI-generated patch</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc66]">{trimmedIssue || SAMPLE_ISSUE}</p>
                </motion.div>
                <div className="grid gap-2">
                  {PR_CHECKS.map((check, index) => {
                    const done = completedCount > index + 1 || visualNodeStatuses.pr_pusher === "done";
                    return (
                      <motion.div
                        key={check}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: hasRun ? 1 : 0.4, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between border border-[#1f1f1f] px-3 py-2 font-mono text-[10px] uppercase tracking-[2px]"
                      >
                        <span className={done ? "text-[#39ff14]" : "text-[#e8e4dc99]"}>{check}</span>
                        <motion.span
                          className={`h-2 w-2 rounded-full ${done ? "bg-[#39ff14]" : "bg-[#1f1f1f]"}`}
                          animate={done ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                          transition={{ duration: 0.7, repeat: done && isStreaming ? Infinity : 0 }}
                        />
                      </motion.div>
                    );
                  })}
                </div>
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
