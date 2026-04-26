"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HexNode } from "./HexNode";
import type { Agent } from "@/lib/types";

// Hardcoded honeycomb positions for up to 6 agents (SVG coords, centered)
const POSITION_MAPS: Record<number, [number, number][]> = {
  0: [],
  1: [[0, 0]],
  2: [[-160, 0], [160, 0]],
  3: [[0, -110], [-175, 65], [175, 65]],
  4: [[-160, -80], [160, -80], [-160, 80], [160, 80]],
  5: [[0, -130], [-180, -40], [180, -40], [-110, 110], [110, 110]],
  6: [[0, -140], [165, -70], [165, 70], [0, 140], [-165, 70], [-165, -70]],
};

function getPositions(n: number): [number, number][] {
  return POSITION_MAPS[Math.min(n, 6)] ?? POSITION_MAPS[6];
}

function shareFiles(a: Agent, b: Agent): boolean {
  const prefix = (f: string) => f.split("/")[0] + "/";
  const aSet = new Set(a.github_data_summary.top_files.map(prefix));
  return b.github_data_summary.top_files.some((f) => aSet.has(prefix(f)));
}

interface Props {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  compact?: boolean;
  pulsingAgentId?: string | null;
  onAddAgent?: () => void;
}

export function HexGrid({ agents, selectedId, onSelect, compact = false, pulsingAgentId, onAddAgent }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const positions = useMemo(() => getPositions(agents.length), [agents.length]);

  const viewBox = compact ? "-250 -200 500 400" : "-500 -360 1000 720";
  const connections = useMemo(() => {
    const pairs: { a: number; b: number }[] = [];
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        if (shareFiles(agents[i], agents[j])) pairs.push({ a: i, b: j });
      }
    }
    return pairs;
  }, [agents]);

  const hoveredAgent = agents.find((a) => a.id === hoveredId);

  return (
    <div className="relative w-full h-full">
      <svg
        width="100%" height="100%"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: "visible" }}
      >
        {/* Connection lines */}
        {connections.map(({ a, b }, idx) => {
          const [ax, ay] = positions[a] ?? [0, 0];
          const [bx, by] = positions[b] ?? [0, 0];
          return (
            <g key={idx}>
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#00f0ff22" strokeWidth={1.5} />
              {/* Particle traveling along line */}
              <motion.circle
                r={2.5} fill="#00f0ff"
                animate={{ cx: [ax, bx, ax], cy: [ay, by, ay], opacity: [0, 0.9, 0.9, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: idx * 0.9, ease: "linear" }}
              />
            </g>
          );
        })}

        {/* Agent nodes */}
        {agents.map((agent, i) => {
          const [cx, cy] = positions[i] ?? [0, 0];
          return (
            <HexNode
              key={agent.id}
              agent={agent}
              cx={cx} cy={cy}
              isSelected={selectedId === agent.id}
              breathDuration={2.8 + i * 0.18}
              compact={compact}
              pulsing={pulsingAgentId === agent.id}
              onClick={() => onSelect(selectedId === agent.id ? null : agent.id)}
              onHover={() => setHoveredId(agent.id)}
              onLeave={() => setHoveredId(null)}
            />
          );
        })}

        {/* Hover tooltip proxy — handled in HTML layer below */}
      </svg>

      {/* Hover tooltip (HTML overlay) */}
      <AnimatePresence>
        {hoveredAgent && !compact && (
          <motion.div
            key={hoveredAgent.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-4 left-4 pointer-events-none z-10 bg-[#0d1224] border border-[#1e2d45] rounded-md px-3 py-2 min-w-[180px]"
            style={{ boxShadow: "0 0 12px #00f0ff20" }}
          >
            <p className="font-mono text-[10px] text-[#4a6080] mb-1">{"// TOP FILES"}</p>
            {hoveredAgent.github_data_summary.top_files.slice(0, 3).map((f) => (
              <p key={f} className="font-mono text-[11px] text-[#c8d6e8]">{f}</p>
            ))}
            <p className="font-mono text-[10px] text-[#4a6080] mt-1">
              {hoveredAgent.github_data_summary.languages.join(" · ")}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add agent button */}
      {!compact && onAddAgent && (
        <button
          onClick={onAddAgent}
          className="absolute bottom-6 left-6 font-mono text-xs text-[#00f0ff] border border-[#1e2d45] bg-[#0d1224] px-4 py-2 rounded transition-all hover:border-[#00f0ff44] hover:bg-[#0d1230]"
        >
          + REGISTER AGENT
        </button>
      )}
    </div>
  );
}
