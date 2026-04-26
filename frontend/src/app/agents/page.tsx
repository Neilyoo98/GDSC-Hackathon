"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAgents } from "@/hooks/useAgents";
import { DossierPanel } from "@/components/DossierPanel";
import { api } from "@/lib/api";
import { coworkerName } from "@/lib/agents";
import type { Agent } from "@/lib/types";

// ── Constitution category colours (matching team page ring key) ────────────
const CAT_COLORS: Record<string, string> = {
  code_ownership: "#39ff14",
  expertise:      "#e8e4dc",
  collaboration:  "#8b5cf6",
  current_focus:  "#f59e0b",
  known_issues:   "#ff3366",
};

// ── Mesh connection logic ──────────────────────────────────────────────────
function agentTokens(agent: Agent): Set<string> {
  const out = new Set<string>();
  for (const fact of agent.constitution_facts ?? []) {
    if (["code_ownership","current_focus","known_issues"].includes(fact.category)) {
      fact.object.toLowerCase().split(/[\s/,;]+/).forEach((t) => { if (t.length > 2) out.add(t); });
    }
  }
  for (const f of agent.github_data_summary?.top_files ?? []) {
    f.toLowerCase().split("/").forEach((t) => { if (t.length > 2) out.add(t); });
  }
  return out;
}
function connected(a: Agent, b: Agent) {
  const ta = agentTokens(a);
  if (!ta.size) return false;
  return Array.from(agentTokens(b)).some((t) => ta.has(t));
}

// ── SVG arc helper ─────────────────────────────────────────────────────────
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = (startDeg * Math.PI) / 180;
  const e = (endDeg   * Math.PI) / 180;
  const x1 = cx + r * Math.cos(s); const y1 = cy + r * Math.sin(s);
  const x2 = cx + r * Math.cos(e); const y2 = cy + r * Math.sin(e);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

// ── Mesh graph ─────────────────────────────────────────────────────────────
function MeshGraph({
  agents, selectedId, onSelect,
}: {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const [dash, setDash] = useState(0);

  // Animate dashes
  useEffect(() => {
    const id = setInterval(() => setDash((d) => (d + 1) % 40), 40);
    return () => clearInterval(id);
  }, []);

  if (!agents.length) return null;

  const W = 900; const H = 600; const CX = W / 2; const CY = H / 2;
  const RADIUS   = Math.min(200, 70 * agents.length);
  const NODE_R   = 36;
  const ARC_R    = NODE_R + 14;

  // Place agents evenly around a circle, starting from top (-90°)
  const positions = agents.map((_, i) => {
    const angle  = ((i / agents.length) * 360 - 90) * (Math.PI / 180);
    return { x: CX + RADIUS * Math.cos(angle), y: CY + RADIUS * Math.sin(angle) };
  });

  // Build connection pairs
  const pairs: [number, number][] = [];
  for (let i = 0; i < agents.length; i++)
    for (let j = i + 1; j < agents.length; j++)
      if (connected(agents[i], agents[j])) pairs.push([i, j]);

  // Constitution arc segments per agent
  const CATS = Object.keys(CAT_COLORS);
  const SEG  = 360 / CATS.length;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      style={{ overflow: "visible" }}
    >
      <defs>
        {agents.map((a, i) => (
          <clipPath key={a.id} id={`av-${a.id}`}>
            <circle cx={positions[i].x} cy={positions[i].y} r={NODE_R - 2} />
          </clipPath>
        ))}
        <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#39ff14" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#39ff14" stopOpacity="0" />
        </radialGradient>
        <filter id="glow-green">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Subtle radial glow at center */}
      <circle cx={CX} cy={CY} r={RADIUS + 60} fill="url(#center-glow)" />

      {/* Orbit ring */}
      <circle
        cx={CX} cy={CY} r={RADIUS}
        fill="none"
        stroke="#39ff14"
        strokeWidth={0.5}
        strokeOpacity={0.25}
        strokeDasharray="4 12"
      />

      {/* Connection lines */}
      {pairs.map(([i, j]) => {
        const a = positions[i]; const b = positions[j];
        const isActive = selectedId === agents[i].id || selectedId === agents[j].id;
        return (
          <g key={`${i}-${j}`}>
            {/* Glow */}
            <line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="#39ff14"
              strokeWidth={isActive ? 4 : 2}
              strokeOpacity={isActive ? 0.25 : 0.08}
            />
            {/* Animated dashed line */}
            <line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="#39ff14"
              strokeWidth={isActive ? 1.5 : 0.8}
              strokeOpacity={isActive ? 0.9 : 0.4}
              strokeDasharray="6 14"
              strokeDashoffset={-dash}
            />
          </g>
        );
      })}

      {/* Spoke lines: center → each agent */}
      {positions.map((p, i) => {
        const isActive = selectedId === agents[i].id;
        return (
          <line
            key={agents[i].id}
            x1={CX} y1={CY} x2={p.x} y2={p.y}
            stroke="#39ff14"
            strokeWidth={isActive ? 1 : 0.5}
            strokeOpacity={isActive ? 0.5 : 0.15}
            strokeDasharray="3 10"
            strokeDashoffset={-dash * 0.5}
          />
        );
      })}

      {/* Agent nodes */}
      {agents.map((agent, i) => {
        const { x, y } = positions[i];
        const isSelected = selectedId === agent.id;
        const facts = agent.constitution_facts ?? [];

        return (
          <g
            key={agent.id}
            style={{ cursor: "pointer" }}
            onClick={() => onSelect(isSelected ? null : agent.id)}
          >
            {/* Outer glow ring when selected */}
            {isSelected && (
              <circle cx={x} cy={y} r={ARC_R + 10}
                fill="none" stroke="#39ff14" strokeWidth={1}
                strokeOpacity={0.6}
                style={{ filter: "drop-shadow(0 0 8px #39ff14)" }}
              />
            )}

            {/* Constitution arcs */}
            {CATS.map((cat, ci) => {
              const count  = facts.filter(f => f.category === cat).length;
              const filled = Math.min(count / 3, 1);
              if (filled === 0) return null;
              const start = ci * SEG - 88;
              const end   = start + SEG * filled * 0.85;
              return (
                <path
                  key={cat}
                  d={arcPath(x, y, ARC_R, start, end)}
                  fill="none"
                  stroke={CAT_COLORS[cat]}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeOpacity={isSelected ? 1 : 0.7}
                  style={{ filter: `drop-shadow(0 0 4px ${CAT_COLORS[cat]}88)` }}
                />
              );
            })}

            {/* Avatar background */}
            <circle cx={x} cy={y} r={NODE_R}
              fill="#0d0d0d"
              stroke={isSelected ? "#39ff14" : "#2a2a2a"}
              strokeWidth={isSelected ? 2 : 1}
            />

            {/* GitHub avatar */}
            <image
              href={`https://github.com/${agent.github_username || agent.name}.png?size=96`}
              x={x - (NODE_R - 2)} y={y - (NODE_R - 2)}
              width={(NODE_R - 2) * 2} height={(NODE_R - 2) * 2}
              clipPath={`url(#av-${agent.id})`}
              preserveAspectRatio="xMidYMid slice"
            />

            {/* Name label */}
            <text
              x={x} y={y + NODE_R + 18}
              textAnchor="middle"
              fill={isSelected ? "#39ff14" : "#e8e4dc"}
              fontSize={11}
              fontFamily="'Space Mono', monospace"
              letterSpacing="0.15em"
              style={{ textTransform: "uppercase", userSelect: "none" }}
            >
              {coworkerName(agent)}
            </text>

            {/* Role label */}
            <text
              x={x} y={y + NODE_R + 32}
              textAnchor="middle"
              fill="#e8e4dc44"
              fontSize={9}
              fontFamily="'Space Mono', monospace"
              letterSpacing="0.1em"
              style={{ textTransform: "uppercase", userSelect: "none" }}
            >
              {(agent.role ?? "").split(",")[0].split("·")[0].trim().slice(0, 20)}
            </text>
          </g>
        );
      })}

      {/* Center MESH node */}
      <g>
        <circle cx={CX} cy={CY} r={22} fill="#080808" stroke="#39ff14" strokeWidth={1} strokeOpacity={0.5} />
        <circle cx={CX} cy={CY} r={6}  fill="#39ff14" opacity={0.9} />
        <text
          x={CX} y={CY + 36}
          textAnchor="middle"
          fill="#39ff14"
          fontSize={9}
          fontFamily="'Space Mono', monospace"
          letterSpacing="0.25em"
          opacity={0.7}
          style={{ textTransform: "uppercase", userSelect: "none" }}
        >
          COWORKER MESH
        </text>
      </g>
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const { agents, isLoading, setAgents } = useAgents();
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [showModal,  setShowModal]      = useState(false);
  const [form,       setForm]           = useState({ github_username: "", name: "", role: "" });
  const [creating,   setCreating]       = useState(false);
  const [createError,setCreateError]    = useState<string | null>(null);

  const agentList   = useMemo(() => (Array.isArray(agents) ? agents : []), [agents]);
  const selectedAgent = agentList.find((a) => a.id === selectedId) ?? null;

  const connectionCount = useMemo(() => {
    let n = 0;
    for (let i = 0; i < agentList.length; i++)
      for (let j = i + 1; j < agentList.length; j++)
        if (connected(agentList[i], agentList[j])) n++;
    return n;
  }, [agentList]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.github_username.trim()) return;
    setCreating(true); setCreateError(null);
    try {
      const agent = await api.createAgent({
        github_username: form.github_username.trim(),
        name: form.name.trim() || undefined,
        role: form.role.trim() || undefined,
      });
      setAgents((prev) => [...prev, agent]);
      setShowModal(false);
      setForm({ github_username: "", name: "", role: "" });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(agent: Agent) {
    await api.deleteAgent(agent.id);
    setAgents((prev) => prev.filter((a) => a.id !== agent.id));
    setSelectedId(null);
  }

  return (
    <div className="flex h-[calc(100vh-52px)] bg-[#080808]">

      {/* ── Main canvas ── */}
      <div className="flex-1 relative overflow-hidden">

        {/* Subtle grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(#e8e4dc 1px,transparent 1px),linear-gradient(90deg,#e8e4dc 1px,transparent 1px)", backgroundSize: "64px 64px" }}
        />

        {/* Top bar */}
        <div className="absolute top-6 left-6 z-10 pointer-events-none">
          <p className="font-mono text-[9px] uppercase tracking-[4px] text-[#39ff14]">{"// COWORKER MESH"}</p>
          <h1 className="font-syne text-3xl font-normal text-[#e8e4dc] mt-1">AUBI Coworkers</h1>
          <p className="font-mono text-[10px] text-[#e8e4dc44] mt-1">
            {agentList.length} coworker{agentList.length !== 1 ? "s" : ""} · {connectionCount} connection{connectionCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Status */}
        <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-pulse" />
          <span className="font-mono text-[9px] uppercase tracking-[3px] text-[#39ff14]">Mesh Online</span>
        </div>

        {/* Visualization */}
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="font-mono text-[10px] uppercase tracking-[4px] text-[#39ff1466]">Loading coworker mesh...</p>
          </div>
        ) : agentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="font-mono text-[11px] uppercase tracking-[3px] text-[#e8e4dc44]">No coworkers registered</p>
            <button
              onClick={() => setShowModal(true)}
              className="font-mono text-[10px] uppercase tracking-[2px] text-[#39ff14] border border-[#39ff1433] px-4 py-2 hover:bg-[#39ff1410] transition-colors"
            >
              + Register first coworker
            </button>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <MeshGraph agents={agentList} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        )}

        {/* Register button */}
        {!isLoading && agentList.length > 0 && (
          <button
            onClick={() => setShowModal(true)}
            className="absolute bottom-6 left-6 z-10 font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc66] border border-[#1f1f1f] px-4 py-2 hover:text-[#e8e4dc] hover:border-[#39ff1433] transition-colors"
          >
            + Register coworker
          </button>
        )}

        {/* Constitution key */}
        <div className="absolute bottom-6 right-6 z-10 border border-[#1f1f1f] bg-[#080808] px-3 py-2.5">
          <p className="font-mono text-[8px] uppercase tracking-[3px] text-[#e8e4dc44] mb-2">{"// constitution"}</p>
          <div className="flex flex-col gap-1.5">
            {Object.entries(CAT_COLORS).map(([key, color]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="font-mono text-[9px] uppercase tracking-[1px] text-[#e8e4dc66]">
                  {key.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Dossier panel ── */}
      <div className={["flex-shrink-0 transition-all duration-300 overflow-hidden border-l border-[#1f1f1f]", selectedAgent ? "w-[360px]" : "w-0"].join(" ")}>
        <DossierPanel agent={selectedAgent} onClose={() => setSelectedId(null)} onDelete={handleDelete} />
      </div>

      {/* ── Register modal ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
              className="bg-[#080808] border border-[#1f1f1f] w-full max-w-sm mx-4"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f1f1f]">
                <span className="font-mono text-[9px] uppercase tracking-[3px] text-[#e8e4dc66]">{"// register coworker"}</span>
                <button onClick={() => setShowModal(false)} className="text-[#e8e4dc44] hover:text-[#e8e4dc] text-xl leading-none">×</button>
              </div>
              <form onSubmit={handleCreate} className="p-5 space-y-4">
                {[
                  { key: "github_username", label: "GitHub username *", placeholder: "e.g. torvalds" },
                  { key: "name",            label: "Display name",       placeholder: "optional" },
                  { key: "role",            label: "Role",               placeholder: "e.g. Backend Engineer" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block font-mono text-[9px] uppercase tracking-[2px] text-[#e8e4dc55] mb-1.5">{label}</label>
                    <input
                      type="text"
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full bg-[#0a0a0a] border border-[#1f1f1f] px-3 py-2 font-mono text-[12px] text-[#e8e4dc] placeholder-[#e8e4dc22] focus:outline-none focus:border-[#39ff1444]"
                    />
                  </div>
                ))}
                {createError && <p className="font-mono text-[10px] text-[#ff3366]">{createError}</p>}
                <button
                  type="submit"
                  disabled={!form.github_username.trim() || creating}
                  className="w-full py-2.5 font-mono text-[11px] uppercase tracking-[3px] font-bold text-[#080808] bg-[#39ff14] disabled:opacity-40 transition-opacity hover:bg-[#44ff22]"
                >
                  {creating ? "Building constitution..." : "Build + Register"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
