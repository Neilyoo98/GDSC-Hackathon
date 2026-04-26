"use client";

import { useEffect, useMemo, useState } from "react";
import { AgentCommFeed } from "@/components/aubi/AgentCommFeed";
import { AgentMeshLines } from "@/components/aubi/AgentMeshLines";
import { useAUBIStream } from "@/hooks/useAUBIStream";
import { useAgents } from "@/hooks/useAgents";
import { api } from "@/lib/api";
import type { GitHubIssue } from "@/lib/types";

export default function DemoPage() {
  const [inputIssueUrl, setInputIssueUrl] = useState("");
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const [latestIssue, setLatestIssue] = useState<GitHubIssue | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const { agentMessages, nodeStatuses, isStreaming, reset } = useAUBIStream(issueUrl);
  const { agents } = useAgents();
  const activeMessage = agentMessages.at(-1) ?? null;

  useEffect(() => {
    let cancelled = false;
    api.pollGitHub()
      .then((data) => {
        if (cancelled) return;
        setLatestIssue(data.issue);
        if (data.issue?.url) setInputIssueUrl(data.issue.url);
      })
      .catch((err) => {
        if (!cancelled) setIssueError(err instanceof Error ? err.message : "Could not load live issue");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const statusText = useMemo(() => {
    if (nodeStatuses.pr_pusher === "done") return "Fixed";
    if (isStreaming) return "Incident Active";
    return latestIssue ? "Live Issue Ready" : "Watching Repo";
  }, [isStreaming, latestIssue, nodeStatuses]);

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
            onClick={() => {
              reset();
              setIssueUrl(inputIssueUrl.trim());
            }}
            disabled={!inputIssueUrl.trim() || isStreaming}
            className="border border-[#39ff14] px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[2px] text-[#39ff14] transition-colors hover:bg-[#39ff14] hover:text-[#080808]"
          >
            Run AUBI
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr] gap-6 p-6">
        <div className="flex min-h-0 flex-col gap-6">
          <AgentMeshLines activeMessage={activeMessage} agents={agents} />
          <AgentCommFeed messages={agentMessages} isStreaming={isStreaming} agents={agents} />
        </div>

        <section className="grid min-h-0 grid-rows-[auto_auto_1fr] gap-6">
          <div className="border border-[#e8e4dc33] bg-[#080808] p-4">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc99]">{"// LIVE BACKEND TARGET"}</div>
            {latestIssue ? (
              <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                <div className="border border-[#1f1f1f] px-3 py-2 font-mono text-[10px] uppercase tracking-[2px] text-[#39ff14]">
                  {latestIssue.repo_name}#{latestIssue.issue_number}
                </div>
                <div className="min-w-0 truncate border border-[#1f1f1f] px-3 py-2 text-xs text-[#e8e4dc99]">
                  {latestIssue.title}
                </div>
              </div>
            ) : (
              <div className="border border-[#1f1f1f] px-3 py-2 font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc66]">
                {issueError ?? "Syncing GitHub issue from backend..."}
              </div>
            )}
          </div>

          <div className="border border-[#e8e4dc33] bg-[#080808] p-4">
            <div className="mb-4 font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc99]">{"// GRAPH PROGRESS"}</div>
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              {[
                ["issue_reader", "Issue Read"],
                ["ownership_router", "Ownership Found"],
                ["query_agents", "Agents Consulted"],
                ["code_reader", "Code Read"],
                ["fix_generator", "Fix Generated"],
                ["approval_gate", "Approval Ready"]
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
            <div className="flex min-h-[220px] flex-col justify-center border border-[#e8e4dc33] bg-[#080808] p-6">
              <p className="font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc99]">{"// REAL AGENTS"}</p>
              <div className="mt-4 grid gap-2">
                {agents.slice(0, 4).map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between border border-[#1f1f1f] px-3 py-2 font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc99]">
                    <span>{agent.name}</span>
                    <span className="text-[#39ff14]">{agent.constitution_facts.length} facts</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex min-h-[220px] flex-col justify-center border border-[#e8e4dc33] bg-[#080808] p-6">
              <p className="font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc99]">{"// RUN STATE"}</p>
              <p className="mt-4 text-sm leading-relaxed text-[#e8e4dc99]">
                {isStreaming
                  ? "AUBI is reading the issue, routing ownership, consulting the agent, generating a patch, and running verification."
                  : agentMessages.length > 0
                    ? "Flow reached the approval checkpoint. Open the Incident page for patch review and PR approval."
                    : "Click Run AUBI to stream the live Neil target-repo issue through the Railway backend."}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
