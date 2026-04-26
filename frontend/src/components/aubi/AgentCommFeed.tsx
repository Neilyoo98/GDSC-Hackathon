"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AgentMessage } from "@/lib/types";

function labelFor(value: string) {
  const key = value.toLowerCase().trim();
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

function isOrchestrator(value: string) {
  return value.toLowerCase().trim() === "orchestrator";
}

export function AgentCommFeed({
  messages,
  isStreaming = false,
}: {
  messages: AgentMessage[];
  isStreaming?: boolean;
}) {
  const scrollRef              = useRef<HTMLDivElement | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    if (messages.length <= revealedCount) return;
    const id = setTimeout(() => setRevealedCount(messages.length), 380);
    return () => clearTimeout(id);
  }, [messages.length, revealedCount]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [revealedCount]);

  const visible = useMemo(() => messages.slice(0, revealedCount), [messages, revealedCount]);
  const pending = revealedCount < messages.length ? messages[revealedCount] : null;

  return (
    <section className="flex h-full flex-col overflow-hidden border-t border-[#1f1f1f] bg-[#080808]">
      {/* header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#1f1f1f] px-4">
        <span className="font-mono text-[8px] uppercase tracking-[3px] text-[#e8e4dc44]">
          {"// agent comms"}
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              isStreaming ? "animate-pulse bg-[#39ff14]" : "bg-[#e8e4dc22]"
            }`}
          />
          <span className="font-mono text-[8px] uppercase tracking-[2px] text-[#e8e4dc33]">
            {isStreaming ? "live" : "standby"}
          </span>
        </div>
      </div>

      {/* feed */}
      <div
        ref={scrollRef}
        className="aubi-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc22]">
            Awaiting agent traffic
          </div>
        )}

        <AnimatePresence initial={false}>
          {visible.map((msg, index) => {
            const fromLeft = isOrchestrator(msg.sender);
            return (
              <motion.div
                key={`${msg.sender}-${msg.recipient}-${index}`}
                initial={{ opacity: 0, x: fromLeft ? -12 : 12, y: 4 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={`flex ${fromLeft ? "justify-start" : "justify-end"}`}
              >
                <div className="max-w-[85%]">
                  {/* sender → recipient row */}
                  <div
                    className={`mb-1.5 flex items-center gap-1.5 ${
                      fromLeft ? "" : "justify-end"
                    }`}
                  >
                    <span
                      className={`font-mono text-[8.5px] uppercase tracking-[1.5px] ${
                        isStreaming ? "text-[#39ff14]" : "text-[#e8e4dc66]"
                      }`}
                    >
                      {labelFor(msg.sender)}
                    </span>
                    <span className="font-mono text-[8px] text-[#e8e4dc22]">→</span>
                    <span className="font-mono text-[8.5px] uppercase tracking-[1.5px] text-[#e8e4dc44]">
                      {labelFor(msg.recipient)}
                    </span>
                  </div>

                  {/* bubble */}
                  <div
                    className={[
                      "relative border px-4 py-3 text-[12px] leading-[1.65] text-[#e8e4dc]",
                      fromLeft
                        ? "border-[#e8e4dc22] border-l-[#e8e4dc55]"
                        : isStreaming
                        ? "border-[#39ff14]/30 border-r-[#39ff14]/70"
                        : "border-[#e8e4dc22] border-r-[#e8e4dc44]",
                    ].join(" ")}
                  >
                    {msg.message}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* typing indicator */}
        {pending && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${isOrchestrator(pending.sender) ? "justify-start" : "justify-end"}`}
          >
            <div className="border border-[#e8e4dc11] px-4 py-3">
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-[3px] w-[3px] rounded-full bg-[#e8e4dc44]"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
