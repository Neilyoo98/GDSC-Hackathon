"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AgentMessage } from "@/lib/types";

const AGENT_META: Record<string, { label: string; align: "left" | "right" }> = {
  orchestrator: { label: "Orchestrator", align: "left" },
  alice_aubi: { label: "Alice's Aubi", align: "right" },
  bob_aubi: { label: "Bob's Aubi", align: "right" },
  carol_aubi: { label: "Carol's Aubi", align: "right" }
};

function keyFor(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("alice")) return "alice_aubi";
  if (lower.includes("bob")) return "bob_aubi";
  if (lower.includes("carol")) return "carol_aubi";
  if (lower.includes("orchestrator")) return "orchestrator";
  return lower;
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
            const meta = AGENT_META[keyFor(message.sender)] ?? { label: message.sender, align: "left" as const };
            const fromLeft = meta.align === "left";
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
                    <span className="font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc66]">→ {AGENT_META[keyFor(message.recipient)]?.label ?? message.recipient}</span>
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
          <div className={`flex ${AGENT_META[keyFor(pending.sender)]?.align === "right" ? "justify-end" : "justify-start"}`}>
            <div className="border border-[#e8e4dc33] bg-[#080808] px-4 py-3 font-mono text-[12px] uppercase tracking-[2px] text-[#e8e4dc99]">
              <span className="mr-2">{AGENT_META[keyFor(pending.sender)]?.label ?? pending.sender}</span>
              <span>typing...</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
