"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Agent, AgentMessage } from "@/lib/types";

function displayName(agent: Agent) {
  return agent.name.replace(/[-_]/g, " ").split(" ")[0] || agent.github_username;
}

function metaFor(value: string, agents: Agent[]): { label: string; align: "left" | "right" } {
  const lower = value.toLowerCase();
  if (lower.includes("orchestrator")) return { label: "Orchestrator", align: "left" };

  const match = agents.find((agent) => {
    const keys = [agent.id, agent.github_username, agent.name].map((item) => item.toLowerCase());
    return keys.some((key) => lower.includes(key));
  });

  return {
    label: match ? `${displayName(match)}'s AUBI` : value,
    align: "right"
  };
}

export function AgentCommFeed({
  messages,
  isStreaming = false,
  agents = []
}: {
  messages: AgentMessage[];
  isStreaming?: boolean;
  agents?: Agent[];
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    if (messages.length <= revealedCount) return;
    const timer = setTimeout(() => setRevealedCount(messages.length), 420);
    return () => clearTimeout(timer);
  }, [messages.length, revealedCount]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, revealedCount]);

  const visibleMessages = useMemo(() => messages.slice(0, revealedCount), [messages, revealedCount]);
  const hasPendingTyping = messages.length > revealedCount;
  const pending = hasPendingTyping ? messages[revealedCount] : null;

  return (
    <section className="flex h-full min-h-[424px] flex-col overflow-hidden border border-[#e8e4dc33] bg-[#080808]">
      <header className="flex h-12 items-center justify-between border-b border-[#1f1f1f] px-4">
        <p className="font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc99]">{"// AGENT COMMS"}</p>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[2px] text-[#39ff14]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#39ff14]" />
          {isStreaming ? "Live" : "Standby"}
        </div>
      </header>

      <div ref={scrollRef} className="aubi-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center font-mono text-sm uppercase tracking-[3px] text-[#e8e4dc66]">
            Awaiting Agent Traffic
          </div>
        )}

        <AnimatePresence initial={false}>
          {visibleMessages.map((message, index) => {
            const meta = metaFor(message.sender, agents);
            const fromLeft = meta.align === "left";
            const recipient = metaFor(message.recipient, agents);
            return (
              <motion.div
                key={`${message.sender}-${message.recipient}-${index}`}
                initial={{ opacity: 0, x: fromLeft ? -16 : 16, y: 8 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex ${fromLeft ? "justify-start" : "justify-end"}`}
              >
                <div className="max-w-[82%]">
                  <div className={`mb-2 flex items-center gap-2 ${fromLeft ? "" : "justify-end"}`}>
                    <span className={`h-2 w-2 rounded-full ${isStreaming ? "bg-[#39ff14]" : "bg-[#e8e4dc]"}`} />
                    <span className="font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc99]">{meta.label}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc66]">→ {recipient.label}</span>
                  </div>
                  <div className={`border px-4 py-3 text-[13px] leading-relaxed text-[#e8e4dc] ${isStreaming ? "border-[#39ff14]" : "border-[#e8e4dc33]"}`}>
                    {message.message}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {pending && (
          <div className={`flex ${metaFor(pending.sender, agents).align === "right" ? "justify-end" : "justify-start"}`}>
            <div className="border border-[#e8e4dc33] bg-[#080808] px-4 py-3 font-mono text-[12px] uppercase tracking-[2px] text-[#e8e4dc99]">
              <span className="mr-2">{metaFor(pending.sender, agents).label}</span>
              <span>typing...</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
