"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { AgentMessage } from "@/lib/types";

type NodePosition = { x: number; y: number; label: string };

function endpointKey(value: string): string {
  return value.toLowerCase().trim() || "unknown";
}

function endpointLabel(value: string): string {
  const key = endpointKey(value);
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

function uniqueEndpoints(messages: AgentMessage[], activeMessage?: AgentMessage | null): string[] {
  const seen = new Set<string>();
  const values = [
    ...messages.flatMap((message) => [message.sender, message.recipient]),
    ...(activeMessage ? [activeMessage.sender, activeMessage.recipient] : []),
  ];
  values.forEach((value) => {
    const key = endpointKey(value);
    if (key) seen.add(key);
  });
  return Array.from(seen);
}

function positionsFor(endpoints: string[]): Record<string, NodePosition> {
  const positions: Record<string, NodePosition> = {};
  const peers = endpoints.filter((endpoint) => endpoint !== "orchestrator");
  if (endpoints.includes("orchestrator")) {
    positions.orchestrator = { x: 50, y: 50, label: "Orchestrator" };
  }

  peers.forEach((endpoint, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(peers.length, 1)) * Math.PI * 2;
    positions[endpoint] = {
      x: 50 + Math.cos(angle) * 34,
      y: 50 + Math.sin(angle) * 32,
      label: endpointLabel(endpoint),
    };
  });

  return positions;
}

function edgesFor(messages: AgentMessage[]): Array<[string, string]> {
  const seen = new Set<string>();
  messages.forEach((message) => {
    const from = endpointKey(message.sender);
    const to = endpointKey(message.recipient);
    if (!from || !to || from === to) return;
    const key = [from, to].sort().join("::");
    seen.add(key);
  });
  return Array.from(seen).map((key) => key.split("::") as [string, string]);
}

export function AgentMeshLines({
  messages,
  activeMessage,
}: {
  messages: AgentMessage[];
  activeMessage?: AgentMessage | null;
}) {
  const endpoints = useMemo(() => uniqueEndpoints(messages, activeMessage), [messages, activeMessage]);
  const positions = useMemo(() => positionsFor(endpoints), [endpoints]);
  const edges = useMemo(() => edgesFor(messages), [messages]);
  const activeSender = activeMessage ? endpointKey(activeMessage.sender) : null;
  const activeRecipient = activeMessage ? endpointKey(activeMessage.recipient) : null;

  return (
    <div className="relative h-[224px] overflow-hidden border border-[#e8e4dc33] bg-[#080808]">
      {endpoints.length === 0 ? (
        <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-[3px] text-[#e8e4dc66]">
          Awaiting Coworker Mesh
        </div>
      ) : (
        <>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {edges.map(([from, to]) => {
              const a = positions[from];
              const b = positions[to];
              if (!a || !b) return null;
              const active =
                (activeSender === from && activeRecipient === to) ||
                (activeSender === to && activeRecipient === from);

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
                      transition={{ duration: 0.9, repeat: 2, ease: "easeInOut" }}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {Object.entries(positions).map(([key, node]) => {
            const active = activeSender === key || activeRecipient === key;
            return (
              <motion.div
                key={key}
                animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={{ duration: 0.8 }}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                <span className={`h-4 w-4 rounded-full border ${active ? "border-[#39ff14] bg-[#39ff14]" : "border-[#e8e4dc33] bg-[#080808]"}`} />
                <span className="font-mono text-[9px] uppercase tracking-[2px] text-[#e8e4dc99]">{node.label}</span>
              </motion.div>
            );
          })}
        </>
      )}
    </div>
  );
}
