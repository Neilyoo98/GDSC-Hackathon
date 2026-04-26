"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Agent, IncidentResult, SSEEvent } from "@/lib/types";
import { SlackMockup } from "./SlackMockup";
import { PostmortemDoc } from "./PostmortemDoc";

export function ResponsePanel({
  result,
  agents,
  events
}: {
  result: IncidentResult | null;
  agents: Agent[];
  events: SSEEvent[];
}) {
  const memory = events.findLast?.((event) => event.node === "memory_updater" && event.status === "done");
  const updated = Array.isArray(memory?.output?.updated) ? (memory?.output?.updated as string[]) : result?.owners ?? [];
  const owner = agents.find((agent) => result?.owners?.includes(agent.id)) ?? agents[0];

  return (
    <AnimatePresence>
      {result && (
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="border-t border-aubi-border bg-aubi-surface/70 p-4"
        >
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-aubi-muted">{"// RESPONSE PACKAGE"}</div>
          <div className="grid gap-4 xl:grid-cols-2">
            <SlackMockup message={result.slack_message} owner={owner} />
            <PostmortemDoc markdown={result.postmortem} />
          </div>
          {updated.length > 0 && (
            <div className="aubi-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
              {updated.map((id, index) => {
                const agent = agents.find((item) => item.id === id);
                return (
                  <motion.span
                    key={`${id}-${index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="shrink-0 rounded border border-emerald-500/30 bg-aubi-surface px-3 py-1 font-mono text-[11px] text-emerald-400"
                  >
                    💾 {agent?.name ?? id} · constitution updated
                  </motion.span>
                );
              })}
            </div>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
