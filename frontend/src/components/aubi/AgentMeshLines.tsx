"use client";

import { motion } from "framer-motion";
import type { Agent, AgentMessage } from "@/lib/types";

type MeshNode = { key: string; x: number; y: number; label: string; agent?: Agent };

const AGENT_POSITIONS = [
  { x: 16, y: 24 },
  { x: 84, y: 28 },
  { x: 22, y: 82 },
  { x: 78, y: 78 }
];

function displayName(agent: Agent) {
  return agent.name.replace(/[-_]/g, " ").split(" ")[0] || agent.github_username;
}

function nodeKeyFor(value: string, agents: Agent[]) {
  const lower = value.toLowerCase();
  if (lower.includes("orchestrator")) return "orchestrator";

  const match = agents.find((agent) => {
    const keys = [agent.id, agent.github_username, agent.name].map((item) => item.toLowerCase());
    return keys.some((key) => lower.includes(key));
  });
  if (match) return `agent:${match.id}`;
  return lower;
}

function buildNodes(agents: Agent[]): MeshNode[] {
  const visibleAgents = agents.slice(0, AGENT_POSITIONS.length);
  const fallbackAgents = visibleAgents.length
    ? visibleAgents
    : [];
  return [
    { key: "orchestrator", x: 50, y: 50, label: "Orchestrator" },
    ...fallbackAgents.map((agent, index) => ({
      key: `agent:${agent.id}`,
      label: displayName(agent),
      agent,
      ...AGENT_POSITIONS[index]
    }))
  ];
}

export function AgentMeshLines({
  activeMessage,
  agents = []
}: {
  activeMessage?: AgentMessage | null;
  agents?: Agent[];
}) {
  const nodes = buildNodes(agents);
  const byKey = Object.fromEntries(nodes.map((node) => [node.key, node]));
  const sender = activeMessage ? byKey[nodeKeyFor(activeMessage.sender, agents)] : null;
  const recipient = activeMessage ? byKey[nodeKeyFor(activeMessage.recipient, agents)] : null;
  const agentNodes = nodes.filter((node) => node.key !== "orchestrator");

  const lines = [
    ...agentNodes.map((node) => ["orchestrator", node.key] as const),
    ...(agentNodes.length >= 2 ? [[agentNodes[0].key, agentNodes[1].key] as const] : [])
  ];

  return (
    <div className="relative h-[224px] overflow-hidden border border-[#e8e4dc33] bg-[#080808]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {lines.map(([from, to]) => {
          const a = byKey[from];
          const b = byKey[to];
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
                  transition={{ duration: 0.9, repeat: 2, ease: "easeInOut" }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {nodes.map((node) => {
        const active = sender === node || recipient === node;
        return (
          <motion.div
            key={node.key}
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

      {agentNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc66]">
          Loading real agent mesh
        </div>
      )}
    </div>
  );
}
