"use client";

import { useMemo, useState } from "react";
import { AgentCommFeed } from "@/components/aubi/AgentCommFeed";
import { AgentMeshLines } from "@/components/aubi/AgentMeshLines";
import { useAUBIStream } from "@/hooks/useAUBIStream";

const DEMO_ISSUE = "https://github.com/aubi-demo/AUBI-Demo/issues/1";

export default function DemoPage() {
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const { agentMessages, nodeStatuses, isStreaming, reset } = useAUBIStream(issueUrl);
  const activeMessage = agentMessages.at(-1) ?? null;

  const statusText = useMemo(() => {
    if (nodeStatuses.pr_pusher === "done") return "Fixed";
    if (isStreaming) return "Incident Active";
    return "Watching Repo";
  }, [isStreaming, nodeStatuses]);

  return (
    <div className="flex h-[calc(100vh-52px)] flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#1f1f1f] bg-[#080808] px-6">
        <div>
          <h1 className="font-syne text-4xl font-normal leading-none text-[#e8e4dc]">AUBI Demo</h1>
          <p className="font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc99]">Issue → Agents Talk → Fix → PR</p>
        </div>
        <div className="flex items-center gap-4">
          <span className={`border px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] ${isStreaming ? "border-[#39ff14] text-[#39ff14]" : "border-[#e8e4dc33] text-[#e8e4dc99]"}`}>
            {statusText}
          </span>
          <button
            onClick={() => {
              reset();
              setIssueUrl(DEMO_ISSUE);
            }}
            className="border border-[#39ff14] px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[2px] text-[#39ff14] transition-colors hover:bg-[#39ff14] hover:text-[#080808]"
          >
            Trigger AUBI
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr] gap-6 p-6">
        <div className="flex min-h-0 flex-col gap-6">
          <AgentMeshLines activeMessage={activeMessage} />
          <AgentCommFeed messages={agentMessages} isStreaming={isStreaming} />
        </div>

        <section className="grid min-h-0 grid-rows-[auto_1fr] gap-6">
          <div className="border border-[#e8e4dc33] bg-[#080808] p-4">
            <div className="mb-4 font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc99]">{"// GRAPH PROGRESS"}</div>
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              {[
                ["issue_reader", "Issue Read"],
                ["ownership_router", "Ownership Found"],
                ["query_agents", "Agents Consulted"],
                ["code_reader", "Code Read"],
                ["fix_generator", "Fix Generated"],
                ["pr_pusher", "PR Pushed"]
              ].map(([node, label]) => {
                const status = nodeStatuses[node] ?? "idle";
                return (
                  <div
                    key={node}
                    className={[
                      "border px-3 py-2 font-mono text-[10px] uppercase tracking-[2px]",
                      status === "done" || status === "running"
                        ? "border-[#39ff14] text-[#39ff14]"
                        : "border-[#1f1f1f] text-[#e8e4dc99]"
                    ].join(" ")}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid min-h-0 gap-6 xl:grid-cols-2">
            <div className="flex items-center justify-center border border-[#e8e4dc33] bg-[#080808] p-6 font-mono text-sm uppercase tracking-[3px] text-[#e8e4dc66]">
              CodeDiffPanel slot · Mitansh
            </div>
            <div className="flex items-center justify-center border border-[#e8e4dc33] bg-[#080808] p-6 font-mono text-sm uppercase tracking-[3px] text-[#e8e4dc66]">
              PRPreviewPanel slot · Mitansh
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
