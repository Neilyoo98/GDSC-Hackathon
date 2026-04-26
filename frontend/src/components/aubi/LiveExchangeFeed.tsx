"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Agent, CoworkerContextExchange, IncidentResult } from "@/lib/types";
import { coworkerName } from "@/lib/agents";
import { resolveSourceAgent, resolveTargetAgent } from "@/lib/agentLookup";
import type { Agent as AgentType } from "@/lib/types";

function safeName(agent: AgentType | undefined): string {
  return agent ? coworkerName(agent) : "AUBI coworker";
}

function avatarUrl(agent: Agent | undefined): string {
  const username = agent?.github_username || agent?.name || "ghost";
  return `https://github.com/${username}.png?size=48`;
}

function contextText(exchange: CoworkerContextExchange): string {
  const raw =
    exchange.context_shared ??
    exchange.shared_context ??
    exchange.context ??
    exchange.summary ??
    exchange.message ??
    "";
  return typeof raw === "string" && raw.trim() ? raw : "Sharing context...";
}

interface Props {
  exchanges: CoworkerContextExchange[];
  agents: Agent[];
  result: IncidentResult | null;
}

export function LiveExchangeFeed({ exchanges, agents, result }: Props) {
  if (!exchanges.length) return null;

  return (
    <div className="mt-3 space-y-3">
      <p className="font-mono text-[9px] text-[#4a6080] tracking-widest">{"// LIVE CONTEXT EXCHANGE"}</p>

      <AnimatePresence initial={false}>
        {exchanges.slice(0, 4).map((exchange, i) => {
          const src = resolveSourceAgent(exchange, result, agents, i);
          const tgt = resolveTargetAgent(exchange, result, agents, i, src);
          const checks = exchange.should_check ?? [];
          const why =
            typeof exchange.why_it_matters === "string"
              ? exchange.why_it_matters
              : typeof exchange.reason === "string"
              ? exchange.reason
              : typeof exchange.why === "string"
              ? exchange.why
              : null;
          const confidence = exchange.confidence ?? null;

          return (
            <motion.div
              key={`exchange-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.12, duration: 0.35, ease: "easeOut" }}
              className="rounded border border-violet-500/20 bg-violet-500/5 overflow-hidden"
            >
              {/* Header: sender → recipient */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-violet-500/10">
                <img
                  src={avatarUrl(src)}
                  alt={safeName(src)}
                  className="w-5 h-5 rounded-full border border-violet-500/30 flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://github.com/ghost.png?size=48"; }}
                />
                <span className="font-mono text-[9px] text-violet-300 truncate">{safeName(src)}</span>
                <motion.span
                  className="font-mono text-[9px] text-violet-400/60"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                >
                  →
                </motion.span>
                <img
                  src={avatarUrl(tgt)}
                  alt={safeName(tgt)}
                  className="w-5 h-5 rounded-full border border-violet-500/30 flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://github.com/ghost.png?size=48"; }}
                />
                <span className="font-mono text-[9px] text-violet-300 truncate">{safeName(tgt)}</span>

                {confidence !== null && (
                  <span className="ml-auto font-mono text-[9px] text-[#4a6080] flex-shrink-0">
                    {Math.round(confidence * 100)}%
                  </span>
                )}
              </div>

              {/* Context shared */}
              <div className="px-3 py-2">
                <p className="text-[11px] leading-relaxed text-[#c8d6e8]">{contextText(exchange)}</p>
              </div>

              {/* Why it matters */}
              {why && (
                <div className="px-3 pb-2">
                  <p className="text-[10px] leading-snug text-amber-400/80">
                    <span className="font-mono text-[9px] text-amber-500/60 mr-1">WHY</span>
                    {why}
                  </p>
                </div>
              )}

              {/* Should-check chips */}
              {checks.length > 0 && (
                <div className="px-3 pb-2.5 flex flex-wrap gap-1">
                  {checks.map((item, j) => (
                    <motion.span
                      key={j}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.12 + j * 0.06 }}
                      className="font-mono text-[8px] text-rose-300 border border-rose-500/25 bg-rose-500/8 px-1.5 py-0.5 rounded"
                    >
                      ⚑ {item}
                    </motion.span>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
