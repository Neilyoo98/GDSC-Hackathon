"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIncidentStream } from "@/hooks/useIncidentStream";
import { useAgents } from "@/hooks/useAgents";
import { IncidentTerminal } from "@/components/IncidentTerminal";
import { NeuralTrace } from "@/components/NeuralTrace";
import { HexGrid } from "@/components/HexGrid";
import { SlackMockup } from "@/components/SlackMockup";
import { PostmortemDoc } from "@/components/PostmortemDoc";

export default function IncidentPage() {
  const [incidentText, setIncidentText] = useState("");
  const { events, isStreaming, result, start, reset } = useIncidentStream();
  const { agents } = useAgents();

  // Find which agent is being queried right now
  const queryingEvent = events.find((e) => e.node === "agent_querier" && e.status === "running");
  const pulsingAgentId: string | null = null; // TODO: map agent name to id if needed

  const primaryOwner = result?.owners?.[0]
    ? agents.find((a) => a.id === result.owners[0])
    : agents[0];

  function handleSubmit() {
    if (!incidentText.trim() || isStreaming) return;
    start(incidentText.trim());
  }

  function handleReset() {
    reset();
    setIncidentText("");
  }

  const hasResult = !!result;
  const hasEvents = events.length > 0;

  return (
    <div className="flex h-[calc(100vh-52px)] overflow-hidden">
      {/* ── LEFT COLUMN ── */}
      <div className="w-[42%] flex-shrink-0 flex flex-col gap-4 p-5 border-r border-[#1e2d45] overflow-y-auto aubi-scrollbar">
        {/* Page label */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-syne text-xl text-white">Incident</p>
            <p className="font-mono text-[10px] text-[#4a6080] mt-0.5">War room · paste and trigger</p>
          </div>
          {hasEvents && (
            <button
              onClick={handleReset}
              className="font-mono text-[10px] text-[#4a6080] border border-[#1e2d45] px-3 py-1.5 rounded hover:text-[#e2e8f0] hover:border-[#2a3f5f] transition-colors"
            >
              RESET
            </button>
          )}
        </div>

        {/* Terminal input */}
        <IncidentTerminal
          value={incidentText}
          onChange={setIncidentText}
          onSubmit={handleSubmit}
          isStreaming={isStreaming}
        />

        {/* Mini agent map */}
        {agents.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[9px] text-[#4a6080] tracking-widest">// AGENT MESH</p>
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
                <span className="font-mono text-[9px] text-[#4a6080] tracking-widest">// INCIDENT RESPONSE</span>
                <button
                  onClick={() => navigator.clipboard.writeText(result.slack_message)}
                  className="font-mono text-[9px] text-[#4a6080] border border-[#1e2d45] px-2 py-1 rounded hover:text-[#00f0ff] hover:border-[#00f0ff33] transition-colors"
                >
                  COPY SLACK ↗
                </button>
              </div>

              {/* Slack + postmortem */}
              <div className="flex-1 flex gap-4 p-5 overflow-hidden min-h-0">
                <div className="flex-1 min-w-0">
                  <SlackMockup
                    message={result.slack_message}
                    agentName={primaryOwner?.name ?? "Unknown"}
                    agentUsername={primaryOwner?.github_username ?? "ghost"}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <PostmortemDoc markdown={result.postmortem} />
                </div>
              </div>

              {/* Constitution update strip */}
              {result.owners.length > 0 && (
                <div className="flex items-center gap-2 px-5 py-2.5 border-t border-[#1e2d45] flex-shrink-0 overflow-x-auto">
                  {result.owners.map((ownerId, i) => {
                    const agent = agents.find((a) => a.id === ownerId);
                    return (
                      <motion.span
                        key={ownerId}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.12 }}
                        className="flex-shrink-0 font-mono text-[10px] text-[#10b981] border border-emerald-500/30 bg-[#0d1224] px-3 py-1 rounded whitespace-nowrap"
                      >
                        💾 {agent?.name ?? ownerId} · constitution updated
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
