"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AgentMessage } from "@/lib/types";

function keyFor(value: string) {
  return value.toLowerCase().trim();
}

function labelFor(value: string) {
  const key = keyFor(value);
  if (key === "orchestrator") return "Orchestrator";

  const cleaned = value
    .replace(/[_-]?aubi$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!cleaned) return "AUBI";

  const base = cleaned.split(/\s+/).find(Boolean) ?? cleaned;
  const name = base.charAt(0).toUpperCase() + base.slice(1);
  return `${name}${name.toLowerCase().endsWith("s") ? "'" : "'s"} AUBI`;
}

function alignFor(value: string): "left" | "right" {
  return keyFor(value) === "orchestrator" ? "left" : "right";
}

export function AgentCommFeed({
  messages,
  isStreaming = false
}: {
  messages: AgentMessage[];
  isStreaming?: boolean;
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
            const fromLeft = alignFor(message.sender) === "left";
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
                    <span className="font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc99]">{labelFor(message.sender)}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc66]">→ {labelFor(message.recipient)}</span>
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
          <div className={`flex ${alignFor(pending.sender) === "right" ? "justify-end" : "justify-start"}`}>
            <div className="border border-[#e8e4dc33] bg-[#080808] px-4 py-3 font-mono text-[12px] uppercase tracking-[2px] text-[#e8e4dc99]">
              <span className="mr-2">{labelFor(pending.sender)}</span>
              <span>typing...</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
