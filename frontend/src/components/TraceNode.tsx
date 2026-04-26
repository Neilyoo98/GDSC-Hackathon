"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { SSEEvent } from "@/lib/types";

const NODE_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
  incident_analyzer: { label: "ANALYZER",    bg: "bg-red-500/10",     text: "text-red-400",    border: "border-red-500/20" },
  ownership_router:  { label: "ROUTER",      bg: "bg-amber-500/10",   text: "text-amber-400",  border: "border-amber-500/20" },
  agent_querier:     { label: "AGENT QUERY", bg: "bg-violet-500/10",  text: "text-violet-400", border: "border-violet-500/20" },
  response_drafter:  { label: "DRAFTER",     bg: "bg-cyan-500/10",    text: "text-cyan-400",   border: "border-cyan-500/20" },
  memory_updater:    { label: "MEMORY",      bg: "bg-emerald-500/10", text: "text-emerald-400",border: "border-emerald-500/20" },
  complete:          { label: "COMPLETE",    bg: "bg-emerald-500/10", text: "text-emerald-400",border: "border-emerald-500/20" },
  error:             { label: "ERROR",       bg: "bg-red-500/10",     text: "text-red-400",    border: "border-red-500/20" },
};

const DOT_COLORS: Record<string, string> = {
  incident_analyzer: "#ff3366",
  ownership_router:  "#ffaa00",
  agent_querier:     "#8b5cf6",
  response_drafter:  "#00f0ff",
  memory_updater:    "#10b981",
  complete:          "#10b981",
  error:             "#ff3366",
};

function RadarAnimation() {
  return (
    <svg width={60} height={60} viewBox="-30 -30 60 60">
      {[0.3, 0.6, 0.9].map((delay, i) => (
        <motion.circle
          key={i} cx={0} cy={0} r={8}
          fill="none" stroke="#ff3366" strokeWidth={1.5}
          animate={{ scale: [0.8, 3], opacity: [0.7, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, delay, ease: "easeOut" }}
        />
      ))}
      <circle cx={0} cy={0} r={5} fill="#ff3366" opacity={0.8} />
    </svg>
  );
}

function RouterAnimation() {
  const endpoints: [number, number][] = [[-36, -18], [36, -18], [0, 40]];
  return (
    <svg width={80} height={70} viewBox="-40 -30 80 70">
      {endpoints.map(([dx, dy], i) => (
        <motion.line
          key={i} x1={0} y1={0} x2={0} y2={0} stroke="#ffaa00" strokeWidth={1.5}
          animate={{ x2: dx, y2: dy, opacity: [1, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18, ease: "easeOut" }}
        />
      ))}
      {endpoints.map(([dx, dy], i) => (
        <motion.circle
          key={`dot-${i}`} cx={dx} cy={dy} r={3} fill="#ffaa00"
          animate={{ opacity: [0, 0.9, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
      <circle cx={0} cy={0} r={4} fill="#ffaa00" />
    </svg>
  );
}

function AgentQueryAnimation({ agentName }: { agentName?: string }) {
  return (
    <div className="flex items-center gap-3">
      <svg width={52} height={52} viewBox="-26 -26 52 52">
        <motion.circle
          cx={0} cy={0} r={20}
          fill="none" stroke="#8b5cf6" strokeWidth={2}
          animate={{ r: [18, 34], opacity: [0.9, 0] }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
        />
        <circle cx={0} cy={0} r={16} fill="#0d1224" stroke="#8b5cf6" strokeWidth={1} />
        <text textAnchor="middle" y={4} fontSize={10} fill="#8b5cf6" fontFamily="JetBrains Mono">
          AI
        </text>
      </svg>
      {agentName && (
        <span className="font-mono text-[10px] text-[#8b5cf6]">
          querying {agentName}...
        </span>
      )}
    </div>
  );
}

function TypewriterAnimation({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const full = "DRAFTING RESPONSE...";

  useEffect(() => {
    let i = 0;
    setDisplayed("");
    const iv = setInterval(() => {
      setDisplayed(full.slice(0, ++i));
      if (i >= full.length) clearInterval(iv);
    }, 45);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="font-mono text-[11px] text-[#00f0ff]">
      <span>{displayed}</span>
      <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}>
        ▊
      </motion.span>
      {text && (
        <p className="mt-1 text-[#4a6080] text-[10px] leading-relaxed max-w-[280px] truncate">
          {text.slice(0, 80)}…
        </p>
      )}
    </div>
  );
}

function ConstellationAnimation() {
  const dots: [number, number][] = [[-28, -14], [28, -14], [0, 24], [-16, 8], [16, 8]];
  return (
    <svg width={70} height={55} viewBox="-35 -24 70 55">
      {dots.slice(1).map(([x2, y2], i) => (
        <motion.line
          key={`line-${i}`}
          x1={dots[i][0]} y1={dots[i][1]} x2={x2} y2={y2}
          stroke="#10b981" strokeWidth={0.8} opacity={0.5}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: i * 0.18 + 0.15, duration: 0.3 }}
        />
      ))}
      {dots.map(([cx, cy], i) => (
        <motion.circle
          key={`dot-${i}`} cx={cx} cy={cy} r={3} fill="#10b981"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.18, duration: 0.25 }}
          style={{ filter: "drop-shadow(0 0 3px #10b981)" }}
        />
      ))}
    </svg>
  );
}

function outputSummary(event: SSEEvent): string {
  if (!event.output) return "";
  const o = event.output;
  switch (event.node) {
    case "incident_analyzer":
      return `SERVICE: ${o.affected_service ?? "?"} · TYPE: ${o.error_type ?? "?"} · ${o.urgency ?? "P?"}`;
    case "ownership_router":
      return `OWNERS: ${Array.isArray(o.owners) ? (o.owners as string[]).join(", ") : "none"}`;
    case "agent_querier":
      return `CONTEXT: ${String(o.context ?? "").slice(0, 80)}...`;
    case "response_drafter":
      return `RESPONSE DRAFTED · ${String(o.slack_message ?? o.slack_msg ?? "").length} chars`;
    case "memory_updater":
      return `UPDATED: ${Array.isArray(o.updated) ? (o.updated as string[]).join(", ") : "none"}`;
    default:
      return "";
  }
}

interface Props {
  event: SSEEvent;
  index: number;
}

export function TraceNode({ event, index }: Props) {
  const meta = NODE_META[event.node] ?? NODE_META.error;
  const dotColor = DOT_COLORS[event.node] ?? "#4a6080";
  const isRunning = event.status === "running";
  const isDone = event.status === "done";
  const summary = isDone ? outputSummary(event) : null;
  const slackText = event.node === "response_drafter" && isRunning
    ? String((event.output as Record<string, unknown>)?.slack_message ?? "")
    : "";

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className="flex gap-3"
    >
      {/* Timeline dot */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
          style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}99` }}
        />
        <div className="w-px flex-1 bg-[#1e2d45] mt-1" />
      </div>

      {/* Content */}
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className={`font-mono text-[9px] tracking-widest uppercase px-2 py-0.5 rounded border ${meta.bg} ${meta.text} ${meta.border}`}>
            {meta.label}
          </span>
          {isRunning && (
            <span className="flex items-center gap-1 font-mono text-[9px] text-[#4a6080]">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: dotColor }} />
              PROCESSING
            </span>
          )}
          {isDone && <span className="font-mono text-[9px] text-[#2a3f5f]">COMPLETE ✓</span>}
          {event.receivedAt != null && (
            <span className="font-mono text-[9px] text-[#2a3f5f] ml-auto">+{event.receivedAt}ms</span>
          )}
        </div>

        {/* Unique animation */}
        {isRunning && (
          <div className="mb-2">
            {event.node === "incident_analyzer" && <RadarAnimation />}
            {event.node === "ownership_router" && <RouterAnimation />}
            {event.node === "agent_querier" && <AgentQueryAnimation agentName={event.agent} />}
            {event.node === "response_drafter" && <TypewriterAnimation text={slackText} />}
            {event.node === "memory_updater" && <ConstellationAnimation />}
          </div>
        )}

        {/* Output summary */}
        {summary && (
          <p className="font-mono text-[10px] text-[#4a6080] leading-snug">{summary}</p>
        )}
      </div>
    </motion.div>
  );
}
