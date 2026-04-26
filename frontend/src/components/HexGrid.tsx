"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HexNode } from "./HexNode";
import { InteractiveBackground } from "./InteractiveBackground";
import type { Agent } from "@/lib/types";

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
  return (POSITION_MAPS[Math.min(n, 6)] ?? POSITION_MAPS[6]).map(([x, y]) => [x, y] as [number, number]);
}

function screenToSVG(svg: SVGSVGElement, clientX: number, clientY: number): [number, number] {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const m = svg.getScreenCTM();
  if (!m) return [0, 0];
  const t = pt.matrixTransform(m.inverse());
  return [t.x, t.y];
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
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [positions, setPositions] = useState<[number, number][]>(() => getPositions(agents.length));

  const draggingRef = useRef<{
    index: number;
    startSvgX: number;
    startSvgY: number;
    startNodeX: number;
    startNodeY: number;
    hasMoved: boolean;
  } | null>(null);

  useEffect(() => {
    setPositions(getPositions(agents.length));
  }, [agents.length]);

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

  const hoveredAgent = agents.find((a) => a.id === hoveredId) ?? null;
  const hoveredIndex = agents.findIndex((a) => a.id === hoveredId);

  const connectedIndices = useMemo(() => {
    if (hoveredIndex < 0) return new Set<number>();
    const set = new Set<number>();
    connections.forEach(({ a, b }) => {
      if (a === hoveredIndex || b === hoveredIndex) { set.add(a); set.add(b); }
    });
    return set;
  }, [hoveredIndex, connections]);

  const handleNodePointerDown = useCallback((index: number, e: React.PointerEvent<SVGGElement>) => {
    if (compact) return;
    e.stopPropagation();
    if (!svgRef.current) return;
    const [svgX, svgY] = screenToSVG(svgRef.current, e.clientX, e.clientY);
    draggingRef.current = {
      index,
      startSvgX: svgX,
      startSvgY: svgY,
      startNodeX: positions[index]?.[0] ?? 0,
      startNodeY: positions[index]?.[1] ?? 0,
      hasMoved: false,
    };
  }, [compact, positions]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !svgRef.current) return;
    const [svgX, svgY] = screenToSVG(svgRef.current, e.clientX, e.clientY);
    const dx = svgX - draggingRef.current.startSvgX;
    const dy = svgY - draggingRef.current.startSvgY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) draggingRef.current.hasMoved = true;
    const { index: i, startNodeX, startNodeY } = draggingRef.current;
    setPositions(prev => {
      const next = prev.map(p => [...p]) as [number, number][];
      next[i] = [startNodeX + dx, startNodeY + dy];
      return next;
    });
  }, []);

  const handleNodePointerUp = useCallback((index: number) => {
    if (!draggingRef.current) return;
    if (!draggingRef.current.hasMoved) {
      const agentId = agents[index]?.id;
      if (agentId) onSelect(selectedId === agentId ? null : agentId);
    }
    draggingRef.current = null;
  }, [agents, onSelect, selectedId]);

  const handleContainerPointerUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  return (
    <div
      className="relative w-full h-full"
      onPointerMove={handlePointerMove}
      onPointerUp={handleContainerPointerUp}
    >
      {!compact && <InteractiveBackground />}

      <svg
        ref={svgRef}
        width="100%" height="100%"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: "visible", position: "relative", zIndex: 1 }}
      >
        {/* Connection lines */}
        {connections.map(({ a, b }, idx) => {
          const [ax, ay] = positions[a] ?? [0, 0];
          const [bx, by] = positions[b] ?? [0, 0];
          const isGlowing = hoveredIndex >= 0 && connectedIndices.has(a) && connectedIndices.has(b);

          return (
            <g key={`${agents[a]?.id ?? a}-${agents[b]?.id ?? b}`}>
              {/* Glow halo when connected agent is hovered */}
              {isGlowing && (
                <line x1={ax} y1={ay} x2={bx} y2={by}
                  stroke="#00f0ff" strokeWidth={6} opacity={0.15}
                  style={{ filter: "blur(4px)" }}
                />
              )}
              {/* Pulsing base line */}
              <motion.line
                x1={ax} y1={ay} x2={bx} y2={by}
                stroke={isGlowing ? "#00f0ffaa" : "#00f0ff28"}
                strokeWidth={isGlowing ? 2 : 1.5}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2.4 + idx * 0.35, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* Particles A → B (cyan) */}
              {!compact && [0, 1, 2].map((p) => (
                <motion.circle
                  key={`f${p}`}
                  r={2.5} fill="#00f0ff"
                  style={{ filter: "drop-shadow(0 0 3px #00f0ffdd)" }}
                  animate={{ cx: [ax, bx], cy: [ay, by], opacity: [0, 1, 1, 0] }}
                  transition={{
                    duration: 2.8,
                    repeat: Infinity,
                    delay: idx * 0.7 + p * 0.95,
                    ease: "linear",
                    times: [0, 0.08, 0.92, 1],
                  }}
                />
              ))}
              {/* Particles B → A (purple) */}
              {!compact && [0, 1].map((p) => (
                <motion.circle
                  key={`r${p}`}
                  r={2} fill="#8b5cf6"
                  style={{ filter: "drop-shadow(0 0 3px #8b5cf6dd)" }}
                  animate={{ cx: [bx, ax], cy: [by, ay], opacity: [0, 0.85, 0.85, 0] }}
                  transition={{
                    duration: 3.5,
                    repeat: Infinity,
                    delay: idx * 0.9 + p * 1.5,
                    ease: "linear",
                    times: [0, 0.08, 0.92, 1],
                  }}
                />
              ))}
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
              onHover={() => setHoveredId(agent.id)}
              onLeave={() => setHoveredId(null)}
              onPointerDown={(e) => handleNodePointerDown(i, e)}
              onPointerUp={() => handleNodePointerUp(i)}
            />
          );
        })}
      </svg>

      {/* Hover tooltip (expertise tags) */}
      <AnimatePresence>
        {hoveredAgent && !compact && (
          <motion.div
            key={hoveredAgent.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-4 left-4 pointer-events-none z-10 bg-[#0d1224] border border-[#1e2d45] rounded-md px-3 py-2.5 min-w-[190px]"
            style={{ boxShadow: "0 0 16px #00f0ff18" }}
          >
            <p className="font-mono text-[9px] text-[#4a6080] tracking-widest mb-2">{"// EXPERTISE"}</p>
            <div className="flex flex-wrap gap-1">
              {(hoveredAgent.constitution_facts.filter((f) => f.category === "expertise").length > 0
                ? hoveredAgent.constitution_facts.filter((f) => f.category === "expertise").slice(0, 3)
                : hoveredAgent.github_data_summary.languages.slice(0, 3).map((l) => ({ object: l }))
              ).map((f) => (
                <span
                  key={"object" in f ? f.object : ""}
                  className="font-mono text-[10px] text-[#c8d6e8] border border-[#1e2d45] bg-[#111827] px-2 py-0.5 rounded"
                >
                  {"object" in f ? f.object : ""}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add agent button */}
      {!compact && onAddAgent && (
        <button
          onClick={onAddAgent}
          className="absolute bottom-6 left-6 font-mono text-xs text-[#00f0ff] border border-[#1e2d45] bg-[#0d1224] px-4 py-2 rounded transition-all hover:border-[#00f0ff44] hover:bg-[#0d1230]"
          style={{ boxShadow: "0 0 8px #00f0ff10" }}
        >
          + REGISTER AGENT
        </button>
      )}
    </div>
  );
}
