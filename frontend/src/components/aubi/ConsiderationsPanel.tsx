"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Agent, CoworkerContextExchange, IncidentResult } from "@/lib/types";
import { resolveTargetAgent, resolveSourceAgent } from "@/lib/agentLookup";
import { coworkerName } from "@/lib/agents";

function safeName(agent: Agent | undefined): string {
  return agent ? coworkerName(agent) : "mesh coworker";
}

interface CheckItem {
  text: string;
  agentName: string;
  resolved: boolean;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\W]+/)
    .filter((t) => t.length > 3);
}

function isResolved(item: string, fixText: string): boolean {
  const needleTokens = tokenize(item);
  if (!needleTokens.length) return false;
  const haystackTokens = new Set(tokenize(fixText));
  // Resolved if ≥40% of the item's meaningful tokens appear in the fix
  const matched = needleTokens.filter((t) => haystackTokens.has(t)).length;
  return matched / needleTokens.length >= 0.4;
}

interface Props {
  exchanges: CoworkerContextExchange[];
  agents: Agent[];
  result: IncidentResult | null;
}

export function ConsiderationsPanel({ exchanges, agents, result }: Props) {
  const fixText = `${result?.patch_diff ?? ""} ${result?.fix_explanation ?? ""}`;
  const hasfix = !!(result?.patch_diff || result?.fix_explanation);

  const items = useMemo<CheckItem[]>(() => {
    const seen = new Set<string>();
    const out: CheckItem[] = [];

    exchanges.forEach((exchange, i) => {
      const checks = exchange.should_check ?? [];
      const responder = resolveTargetAgent(exchange, result, agents, i, resolveSourceAgent(exchange, result, agents, i));
      const name = safeName(responder);

      checks.forEach((text) => {
        const key = text.toLowerCase().trim();
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ text, agentName: name, resolved: hasfix && isResolved(text, fixText) });
      });
    });

    return out;
  }, [exchanges, agents, result, fixText, hasfix]);

  if (!items.length) return null;

  const resolvedCount = items.filter((i) => i.resolved).length;

  return (
    <div className="self-start border border-[#1e2d45] bg-[#0a0e1a] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-[9px] text-[#4a6080] tracking-widest">{"// CONSIDERATIONS"}</p>
        {hasfix && (
          <span className={[
            "font-mono text-[9px] px-2 py-0.5 rounded border",
            resolvedCount === items.length
              ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
              : "text-amber-300 border-amber-500/30 bg-amber-500/10",
          ].join(" ")}>
            {resolvedCount}/{items.length} addressed
          </span>
        )}
      </div>

      <p className="text-[10px] text-[#4a6080] mb-3 leading-snug">
        Items flagged by the coworker mesh — verified against the generated fix.
      </p>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {items.map((item, i) => (
            <motion.div
              key={item.text}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className={[
                "flex items-start gap-2.5 px-3 py-2 rounded border transition-colors duration-500",
                item.resolved && hasfix
                  ? "border-emerald-500/25 bg-emerald-500/5"
                  : hasfix
                  ? "border-amber-500/20 bg-amber-500/5"
                  : "border-[#1e2d45] bg-[#050912]",
              ].join(" ")}
            >
              {/* Status icon */}
              <span className="mt-0.5 flex-shrink-0 text-[11px]">
                {hasfix ? (item.resolved ? "✓" : "?") : "⚑"}
              </span>

              <div className="flex-1 min-w-0">
                <p className={[
                  "text-[11px] leading-snug transition-colors duration-500",
                  item.resolved && hasfix
                    ? "text-emerald-300 line-through decoration-emerald-500/60"
                    : hasfix
                    ? "text-amber-300"
                    : "text-[#c8d6e8]",
                ].join(" ")}>
                  {item.text}
                </p>
                <p className="font-mono text-[8px] text-[#4a6080] mt-0.5">flagged by {item.agentName}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
