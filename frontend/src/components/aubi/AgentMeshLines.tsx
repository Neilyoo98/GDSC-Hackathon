"use client";

import { motion } from "framer-motion";
import type { AgentMessage } from "@/lib/types";

const NODE_POSITIONS: Record<string, { x: number; y: number; label: string }> = {
  orchestrator: { x: 50, y: 50, label: "Orchestrator" },
  alice_aubi: { x: 16, y: 22, label: "Alice" },
  bob_aubi: { x: 84, y: 30, label: "Bob" },
  carol_aubi: { x: 50, y: 84, label: "Carol" }
};

const LINES = [
  ["orchestrator", "alice_aubi"],
  ["orchestrator", "bob_aubi"],
  ["orchestrator", "carol_aubi"],
  ["alice_aubi", "bob_aubi"]
] as const;

function normalizeEndpoint(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("alice")) return "alice_aubi";
  if (lower.includes("bob")) return "bob_aubi";
  if (lower.includes("carol")) return "carol_aubi";
  if (lower.includes("orchestrator")) return "orchestrator";
  return lower;
}

export function AgentMeshLines({ activeMessage }: { messages?: AgentMessage[]; activeMessage?: AgentMessage | null }) {
  const sender = activeMessage ? NODE_POSITIONS[normalizeEndpoint(activeMessage.sender)] : null;
  const recipient = activeMessage ? NODE_POSITIONS[normalizeEndpoint(activeMessage.recipient)] : null;

  return (
    <div className="relative h-[224px] overflow-hidden border border-[#e8e4dc33] bg-[#080808]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {LINES.map(([from, to]) => {
          const a = NODE_POSITIONS[from];
          const b = NODE_POSITIONS[to];
          const active =
            (sender === a && recipient === b) ||
            (sender === b && recipient === a);

          return (
            <g key={`${from}-${to}`}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={active ? "#39ff14" : "#1f1f1f"}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              {active && (
                <motion.circle
                  r={1.1}
                  fill="#39ff14"
                  initial={{ opacity: 0 }}
                  animate={{ cx: [a.x, b.x], cy: [a.y, b.y], opacity: [0, 1, 0] }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {Object.entries(NODE_POSITIONS).map(([key, node]) => {
        const active = sender === node || recipient === node;
        return (
          <motion.div
            key={key}
            animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={{ duration: 0.8, repeat: active ? Infinity : 0, repeatDelay: 0.4 }}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <span className={`h-4 w-4 rounded-full border ${active ? "border-[#39ff14] bg-[#39ff14]" : "border-[#e8e4dc33] bg-[#080808]"}`} />
            <span className="font-mono text-[9px] uppercase tracking-[2px] text-[#e8e4dc99]">{node.label}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
