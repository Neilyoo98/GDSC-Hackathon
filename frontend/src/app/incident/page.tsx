"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIncidentStream } from "@/hooks/useIncidentStream";
import { useAgents } from "@/hooks/useAgents";
import { IncidentTerminal } from "@/components/IncidentTerminal";
import { NeuralTrace } from "@/components/NeuralTrace";
import { HexGrid } from "@/components/HexGrid";
import { CoworkerMeshPanel } from "@/components/CoworkerMeshPanel";
import { api } from "@/lib/api";
import type { GitHubIssue } from "@/lib/types";

export default function IncidentPage() {
  const [issueUrl, setIssueUrl] = useState("");
  const [latestIssue, setLatestIssue] = useState<GitHubIssue | null>(null);
  const [isLoadingIssue, setIsLoadingIssue] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const { events, isStreaming, result, error, start, approve, reset } = useIncidentStream();
  const { agents } = useAgents();

  const pulsingAgentId: string | null = null;

  const primaryOwner = result?.owners?.[0]
    ? agents.find((a) => a.id === result.owners[0])
    : agents[0];

  function handleSubmit() {
    if (!issueUrl.trim() || isStreaming) return;
    start(issueUrl.trim());
  }

  async function loadLatestIssue() {
    setIsLoadingIssue(true);
    setIssueError(null);
    try {
      const data = await api.pollGitHub();
      setLatestIssue(data.issue);
      if (data.issue?.url && !issueUrl.trim()) {
        setIssueUrl(data.issue.url);
      }
    } catch (err) {
      setIssueError(err instanceof Error ? err.message : "Failed to load GitHub issue");
    } finally {
      setIsLoadingIssue(false);
    }
  }

  function handleReset() {
    reset();
    setApprovalAction(null);
    setApprovalError(null);
    setIssueUrl(latestIssue?.url ?? "");
  }

  async function handleApproval(approved: boolean) {
    setApprovalAction(approved ? "approve" : "reject");
    setApprovalError(null);
    try {
      await approve(approved);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "Approval request failed");
    } finally {
      setApprovalAction(null);
    }
  }

  useEffect(() => {
    void loadLatestIssue();
    // Run once on page load; manual refresh uses the button below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasResult = !!result;
  const hasEvents = events.length > 0;
  const memoryWrites = result?.memory_writes ?? result?.memory_updates ?? [];

  return (
    <div className="flex h-[calc(100vh-52px)] overflow-hidden">
      {/* ── LEFT COLUMN ── */}
      <div className="w-[42%] flex-shrink-0 flex flex-col gap-4 p-5 border-r border-[#1e2d45] overflow-y-auto aubi-scrollbar">
        {/* Page label */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-syne text-xl text-white">Incident</p>
            <p className="font-mono text-[10px] text-[#4a6080] mt-0.5">War room · GitHub issue to PR</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadLatestIssue()}
              disabled={isLoadingIssue || isStreaming}
              className="font-mono text-[10px] text-[#4a6080] border border-[#1e2d45] px-3 py-1.5 rounded hover:text-[#e2e8f0] hover:border-[#2a3f5f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isLoadingIssue ? "SYNCING" : "LIVE ISSUE"}
            </button>
            {hasEvents && (
              <button
                onClick={handleReset}
                className="font-mono text-[10px] text-[#4a6080] border border-[#1e2d45] px-3 py-1.5 rounded hover:text-[#e2e8f0] hover:border-[#2a3f5f] transition-colors"
              >
                RESET
              </button>
            )}
          </div>
        </div>

        {latestIssue && (
          <div className="border border-[#1e2d45] bg-[#0a0e1a] px-3 py-2 rounded">
            <p className="font-mono text-[9px] text-[#4a6080] tracking-widest">{"// LIVE GITHUB ISSUE"}</p>
            <p className="mt-1 truncate text-xs text-[#c8d6e8]">{latestIssue.repo_name}#{latestIssue.issue_number} · {latestIssue.title}</p>
          </div>
        )}

        {issueError && (
          <div className="border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-mono text-[11px] text-amber-300">
            {issueError}
          </div>
        )}

        {/* Terminal input */}
        <IncidentTerminal
          value={issueUrl}
          onChange={setIssueUrl}
          onSubmit={handleSubmit}
          isStreaming={isStreaming}
        />

        {error && (
          <div className="border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-[11px] text-red-300">
            {error}
          </div>
        )}

        <CoworkerMeshPanel result={result} agents={agents} events={events} />

        {/* Mini agent map */}
        {agents.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[9px] text-[#4a6080] tracking-widest">{"// AGENT MESH"}</p>
            <div className="h-[180px] border border-[#1e2d45] rounded bg-[#0a0e1a] overflow-hidden">
              <HexGrid
                agents={agents}
                selectedId={null}
                onSelect={() => {}}
                compact
                pulsingAgentId={pulsingAgentId}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT COLUMN ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Neural trace */}
        <div className={[
          "transition-all duration-500 overflow-hidden border-b border-[#1e2d45]",
          hasResult ? "flex-none h-[55%]" : "flex-1",
        ].join(" ")}>
          <div className="h-full p-5">
            <NeuralTrace events={events} isStreaming={isStreaming} />
          </div>
        </div>

        {/* Response panel */}
        <AnimatePresence>
          {hasResult && result && (
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Response header */}
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#1e2d45] flex-shrink-0">
                <span className="font-mono text-[9px] text-[#4a6080] tracking-widest">{"// FIX REVIEW"}</span>
                <div className="flex items-center gap-2">
                  {result.awaiting_approval && (
                    <>
                      <button
                        onClick={() => void handleApproval(false)}
                        disabled={approvalAction !== null}
                        className="font-mono text-[9px] text-rose-300 border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 rounded disabled:cursor-not-allowed disabled:opacity-40 transition-colors hover:border-rose-400"
                      >
                        {approvalAction === "reject" ? "REJECTING..." : "REJECT"}
                      </button>
                      <button
                        onClick={() => void handleApproval(true)}
                        disabled={!result.tests_passed || approvalAction !== null}
                        className="font-mono text-[9px] text-[#04130d] border border-emerald-400 bg-emerald-400 px-3 py-1.5 rounded disabled:cursor-not-allowed disabled:opacity-40 transition-colors hover:bg-emerald-300"
                      >
                        {approvalAction === "approve" ? "PUSHING..." : "APPROVE PR PUSH"}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => navigator.clipboard.writeText(result.patch_diff ?? "")}
                    className="font-mono text-[9px] text-[#4a6080] border border-[#1e2d45] px-2 py-1 rounded hover:text-[#00f0ff] hover:border-[#00f0ff33] transition-colors"
                  >
                    COPY DIFF
                  </button>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-4 p-5 overflow-hidden min-h-0">
                <div className="aubi-scrollbar min-w-0 flex flex-col gap-3 overflow-y-auto pr-1">
                  <div className="border border-[#1e2d45] bg-[#0a0e1a] rounded p-4">
                    <p className="font-mono text-[9px] text-[#4a6080] tracking-widest mb-2">{"// OWNER"}</p>
                    <p className="font-syne text-lg text-white">{primaryOwner?.name ?? result.owners[0] ?? "Unassigned"}</p>
                    <p className="font-mono text-[11px] text-[#4a6080]">{primaryOwner?.github_username ?? "Qdrant ownership match"}</p>
                  </div>

                  <div className="border border-[#1e2d45] bg-[#0a0e1a] rounded p-4">
                    <p className="font-mono text-[9px] text-[#4a6080] tracking-widest mb-2">{"// FIX EXPLANATION"}</p>
                    <p className="text-sm leading-relaxed text-[#c8d6e8]">
                      {result.fix_explanation ?? "Waiting for fix generation..."}
                    </p>
                  </div>

                  <div className="border border-[#1e2d45] bg-[#0a0e1a] rounded p-4">
                    <p className="font-mono text-[9px] text-[#4a6080] tracking-widest mb-2">{"// VERIFICATION"}</p>
                    <p className={["font-mono text-[11px]", result.tests_passed ? "text-emerald-300" : "text-amber-300"].join(" ")}>
                      {result.tests_passed === undefined ? "Waiting for tests..." : result.tests_passed ? "go test ./... passed" : "go test ./... did not pass"}
                    </p>
                    {result.test_output && (
                      <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-[10px] leading-relaxed text-[#8aa0c0]">
                        {result.test_output}
                      </pre>
                    )}
                  </div>

                  {result.awaiting_approval && (
                    <button
                      onClick={() => void handleApproval(true)}
                      disabled={!result.tests_passed || approvalAction !== null}
                      className="h-11 rounded border border-emerald-500 bg-emerald-500 text-sm font-mono font-bold tracking-widest text-[#04130d] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {approvalAction === "approve" ? "PUSHING PR..." : "APPROVE PR PUSH"}
                    </button>
                  )}

                  {approvalError && (
                    <div className="border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-[11px] text-red-300">
                      {approvalError}
                    </div>
                  )}

                  {result.pr_url && (
                    <a
                      href={result.pr_url}
                      target="_blank"
                      rel="noreferrer"
                      className="h-11 rounded border border-[#00f0ff] bg-[#00f0ff] text-sm font-mono font-bold tracking-widest text-[#031018] flex items-center justify-center"
                    >
                      OPEN GITHUB PR
                    </a>
                  )}
                </div>

                <div className="min-w-0 flex flex-col overflow-hidden border border-[#1e2d45] bg-[#050912] rounded">
                  <div className="px-4 py-2 border-b border-[#1e2d45]">
                    <span className="font-mono text-[9px] text-[#4a6080] tracking-widest">{"// GENERATED PATCH"}</span>
                  </div>
                  <pre className="flex-1 overflow-auto whitespace-pre-wrap p-4 text-[11px] leading-relaxed text-[#c8d6e8]">
                    {result.patch_diff ?? "Waiting for patch..."}
                  </pre>
                </div>
              </div>

              {/* Constitution update strip */}
              {memoryWrites.length > 0 && (
                <div className="flex items-center gap-2 px-5 py-2.5 border-t border-[#1e2d45] flex-shrink-0 overflow-x-auto">
                  {memoryWrites.map((write, i) => {
                    const agentId = write.agent_id ?? write.subject ?? write.team_id ?? "team";
                    const agent = agents.find((a) => a.id === agentId || a.name === write.agent_name);
                    return (
                      <motion.span
                        key={`${write.scope ?? "memory"}-${agentId}-${i}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.12 }}
                        className="flex-shrink-0 font-mono text-[10px] text-[#10b981] border border-emerald-500/30 bg-[#0d1224] px-3 py-1 rounded whitespace-nowrap"
                      >
                        {agent?.name ?? write.agent_name ?? (write.scope === "team" ? "Team memory" : agentId)} · memory written
                      </motion.span>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
