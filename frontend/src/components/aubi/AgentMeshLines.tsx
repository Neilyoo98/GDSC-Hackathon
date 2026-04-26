"use client";

import { motion } from "framer-motion";
import type { AgentMessage } from "@/lib/types";

type Position = { x: number; y: number; label: string };

function endpointKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "aubi";
}

function endpointLabel(value: string) {
  const key = endpointKey(value);
  if (key === "orchestrator") return "Orchestrator";
  const cleaned = value
    .replace(/[_-]?aubi$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!cleaned) return "AUBI";
  const base = cleaned.split(/\s+/).find(Boolean) ?? cleaned;
  return `${base.charAt(0).toUpperCase()}${base.slice(1)} AUBI`;
}

function uniqueEndpoints(messages: AgentMessage[], activeMessage?: AgentMessage | null): string[] {
  const values = [
    ...messages.flatMap((message) => [message.sender, message.recipient]),
    ...(activeMessage ? [activeMessage.sender, activeMessage.recipient] : []),
  ];
  const byKey = new Map<string, string>();
  values.forEach((value) => byKey.set(endpointKey(value), value));
  return Array.from(byKey.values());
}

function positionsFor(endpoints: string[]): Record<string, Position> {
  const positions: Record<string, Position> = {};
  const orchestrator = endpoints.find((endpoint) => endpointKey(endpoint) === "orchestrator");
  const coworkers = endpoints.filter((endpoint) => endpointKey(endpoint) !== "orchestrator");

  if (orchestrator) {
    positions[endpointKey(orchestrator)] = { x: 50, y: 50, label: endpointLabel(orchestrator) };
  }

  coworkers.forEach((endpoint, index) => {
    const count = Math.max(coworkers.length, 1);
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    const radius = orchestrator ? 34 : 28;
    positions[endpointKey(endpoint)] = {
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
      label: endpointLabel(endpoint),
    };
  });

  return positions;
}

function edgesFor(messages: AgentMessage[]): Array<[string, string]> {
  const seen = new Set<string>();
  return messages.flatMap((message) => {
    const from = endpointKey(message.sender);
    const to = endpointKey(message.recipient);
    const key = [from, to].sort().join("-");
    if (from === to || seen.has(key)) return [];
    seen.add(key);
    return [[from, to] as [string, string]];
  });
}

export function AgentMeshLines({
  messages = [],
  activeMessage,
}: {
  messages?: AgentMessage[];
  activeMessage?: AgentMessage | null;
}) {
  const endpoints = uniqueEndpoints(messages, activeMessage);
  const positions = positionsFor(endpoints);
  const edges = edgesFor(messages);
  const sender = activeMessage ? positions[endpointKey(activeMessage.sender)] : null;
  const recipient = activeMessage ? positions[endpointKey(activeMessage.recipient)] : null;

  if (endpoints.length === 0) {
    return (
      <div className="relative flex h-[224px] items-center justify-center overflow-hidden border border-[#e8e4dc33] bg-[#080808]">
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc66]">Awaiting Coworker Mesh</p>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[2px] text-[#e8e4dc44]">Run a live issue to draw message paths</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[224px] overflow-hidden border border-[#e8e4dc33] bg-[#080808]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {edges.map(([from, to]) => {
          const a = positions[from];
          const b = positions[to];
          if (!a || !b) return null;
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

      {Object.entries(positions).map(([key, node]) => {
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
