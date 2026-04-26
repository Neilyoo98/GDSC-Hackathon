"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAgents } from "@/hooks/useAgents";
import { DossierPanel } from "@/components/DossierPanel";
import { api } from "@/lib/api";
import { coworkerName } from "@/lib/agents";
import { PerspectiveGrid } from "@/components/PerspectiveGrid";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { BorderBeam } from "@/components/ui/border-beam";
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
type MeshConnection = {
  a: number;
  b: number;
  score: number;
  label: string;
  evidence: string[];
  category: keyof typeof CAT_COLORS;
};

const STOP_WORDS = new Set([
  "and", "the", "with", "from", "this", "that", "there", "their", "repo", "repos",
  "directory", "directories", "file", "files", "active", "recent", "contributions",
  "significant", "working", "focus", "based", "provided", "activity", "data",
]);

function topDirectory(path: string): string {
  const clean = path.trim().replace(/^\/+/, "");
  if (!clean) return "";
  if (!clean.includes("/")) return clean.toLowerCase();
  return `${clean.split("/")[0].toLowerCase()}/`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function overlap(left: string[], right: string[]): string[] {
  const rightSet = new Set(right.map((value) => value.toLowerCase()));
  return unique(left.filter((value) => rightSet.has(value.toLowerCase())));
}

function factObjects(agent: Agent, category: string): string[] {
  return (agent.constitution_facts ?? [])
    .filter((fact) => fact.category === category)
    .map((fact) => fact.object)
    .filter(Boolean);
}

function ownershipPaths(agent: Agent): string[] {
  const fromFacts = factObjects(agent, "code_ownership").flatMap((object) => {
    const explicitPaths = object.match(/[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]*/g) ?? [];
    return explicitPaths.map(topDirectory);
  });
  const fromSummary = (agent.github_data_summary?.top_files ?? []).map(topDirectory);
  return unique([...fromFacts, ...fromSummary]).filter((value) => value.length > 1);
}

function languages(agent: Agent): string[] {
  return unique(agent.github_data_summary?.languages ?? []).slice(0, 8);
}

function repos(agent: Agent): string[] {
  return unique([...(agent.github_data_summary?.target_repos ?? []), ...(agent.github_data_summary?.repos_considered ?? [])]);
}

function tokensFromFacts(agent: Agent, categories: string[]): string[] {
  return unique(
    categories
      .flatMap((category) => factObjects(agent, category))
      .flatMap((object) => object.toLowerCase().split(/[^a-z0-9_.-]+/))
      .filter((token) => token.length > 3 && !STOP_WORDS.has(token))
  );
}

function readableList(values: string[], max = 2): string {
  const shown = values.slice(0, max);
  if (shown.length === 0) return "";
  return shown.join(", ");
}

function shortOwner(agent: Agent): string {
  return agent.github_username || agent.name || agent.id;
}

function primarySignal(connection: MeshConnection): string {
  if (connection.category === "code_ownership") return "Shared code area";
  if (connection.category === "current_focus") return "Related focus";
  if (connection.category === "expertise") return "Shared expertise";
  return "Shared repo context";
}

function buildConnection(a: Agent, b: Agent, ai: number, bi: number): MeshConnection | null {
  const sharedDirs = overlap(ownershipPaths(a), ownershipPaths(b));
  const sharedLanguages = overlap(languages(a), languages(b));
  const sharedRepos = overlap(repos(a), repos(b));
  const sharedFocus = overlap(tokensFromFacts(a, ["current_focus", "known_issues"]), tokensFromFacts(b, ["current_focus", "known_issues"]));

  const evidence: string[] = [];
  if (sharedDirs.length) evidence.push(`both touch ${readableList(sharedDirs, 3)}`);
  if (sharedFocus.length) evidence.push(`related focus: ${readableList(sharedFocus, 3)}`);
  if (sharedLanguages.length) evidence.push(`shared stack: ${readableList(sharedLanguages, 3)}`);
  if (sharedRepos.length) evidence.push(`same repo context: ${readableList(sharedRepos, 2)}`);

  const score =
    sharedDirs.length * 5 +
    sharedFocus.length * 3 +
    sharedLanguages.length * 1.25 +
    sharedRepos.length;

  if (score < 3.5 || evidence.length === 0) return null;

  const category: MeshConnection["category"] = sharedDirs.length
    ? "code_ownership"
    : sharedFocus.length
      ? "current_focus"
      : sharedLanguages.length
        ? "expertise"
        : "collaboration";

  return {
    a: ai,
    b: bi,
    score,
    label: sharedDirs[0] ?? sharedFocus[0] ?? sharedLanguages[0] ?? "repo",
    evidence,
    category,
  };
}

function meshConnections(agents: Agent[]): MeshConnection[] {
  const links: MeshConnection[] = [];
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const link = buildConnection(agents[i], agents[j], i, j);
      if (link) links.push(link);
    }
  }
  return links.sort((left, right) => right.score - left.score).slice(0, Math.max(agents.length, 4));
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
  agents, connections, selectedId, onSelect,
}: {
  agents: Agent[];
  connections: MeshConnection[];
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

      {/* Evidence-backed connection lines */}
      {connections.map((connection) => {
        const a = positions[connection.a]; const b = positions[connection.b];
        if (!a || !b) return null;
        const isActive = selectedId === agents[connection.a]?.id || selectedId === agents[connection.b]?.id;
        const color = CAT_COLORS[connection.category] ?? "#39ff14";
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        return (
          <g key={`${agents[connection.a]?.id}-${agents[connection.b]?.id}`}>
            {/* Glow */}
            <line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={color}
              strokeWidth={isActive ? 4 : 2}
              strokeOpacity={isActive ? 0.25 : 0.08}
            />
            {/* Animated dashed line */}
            <line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={color}
              strokeWidth={isActive ? 1.5 : 0.8}
              strokeOpacity={isActive ? 0.9 : 0.4}
              strokeDasharray="6 14"
              strokeDashoffset={-dash}
            />
            <g opacity={isActive || !selectedId ? 0.92 : 0.35}>
              <rect
                x={mx - 34}
                y={my - 9}
                width={68}
                height={18}
                rx={2}
                fill="#080808"
                stroke={color}
                strokeOpacity={0.2}
              />
              <text
                x={mx}
                y={my + 3}
                textAnchor="middle"
                fill={color}
                fontSize={7}
                fontFamily="'Space Mono', monospace"
                letterSpacing="0.08em"
                style={{ textTransform: "uppercase", userSelect: "none" }}
              >
                {connection.label.slice(0, 12)}
              </text>
            </g>
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
              {`${agent.github_data_summary?.commit_count ?? 0} commits · ${ownershipPaths(agent)[0] ?? "memory"}`.slice(0, 26)}
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

function MeshEvidencePanel({ agents, connections }: { agents: Agent[]; connections: MeshConnection[] }) {
  const totalFacts = agents.reduce((sum, agent) => sum + (agent.constitution_facts?.length ?? 0), 0);
  const totalCommits = agents.reduce((sum, agent) => sum + (agent.github_data_summary?.commit_count ?? 0), 0);

  return (
    <div className="absolute right-6 top-20 z-10 w-[390px] border border-[#1f1f1f] bg-[#080808]/95 p-4 backdrop-blur">
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          ["facts", totalFacts],
          ["commits", totalCommits],
          ["links", connections.length],
        ].map(([label, value]) => (
          <div key={label} className="border border-[#1f1f1f] px-3 py-2">
            <p className="font-mono text-sm text-[#e8e4dc]">{value}</p>
            <p className="font-mono text-[8px] uppercase tracking-[2px] text-[#e8e4dc55]">{label}</p>
          </div>
        ))}
      </div>

      <p className="font-mono text-[8px] uppercase tracking-[3px] text-[#39ff14]">{"// what the mesh means"}</p>
      <p className="mt-2 text-xs leading-relaxed text-[#e8e4dc99]">
        Lines are not decorative. Each one is created from live constitution evidence: shared code areas,
        related focus, shared stack, or the same target repo.
      </p>

      <div className="mt-4 space-y-2">
        {connections.length === 0 ? (
          <div className="border border-dashed border-[#1f1f1f] px-3 py-3 font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc55]">
            No strong coworker links found yet.
          </div>
        ) : (
          connections.slice(0, 4).map((connection) => {
            const left = agents[connection.a];
            const right = agents[connection.b];
            const color = CAT_COLORS[connection.category];
            return (
              <button
                key={`${left?.id}-${right?.id}`}
                className="block w-full border border-[#1f1f1f] bg-[#0d0d0d] px-3 py-2 text-left transition-colors hover:border-[#39ff1444]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-mono text-[10px] uppercase tracking-[1.5px] text-[#e8e4dc]">
                    {shortOwner(left)} <span className="text-[#e8e4dc44]">↔</span> {shortOwner(right)}
                  </p>
                  <span className="shrink-0 font-mono text-[8px] uppercase tracking-[1.5px]" style={{ color }}>
                    {primarySignal(connection)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#e8e4dc88]">
                  {connection.evidence.join(" · ")}
                </p>
              </button>
            );
          })
        )}
      </div>
    </div>
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
  const connections = useMemo(() => meshConnections(agentList), [agentList]);
  const connectionCount = connections.length;

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

        {/* Interactive 3D perspective grid */}
        <PerspectiveGrid />

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
            <MeshGraph agents={agentList} connections={connections} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        )}

        {!isLoading && agentList.length > 0 && !selectedAgent && (
          <MeshEvidencePanel agents={agentList} connections={connections} />
        )}

        {/* Register button */}
        {!isLoading && agentList.length > 0 && (
          <div className="absolute bottom-6 left-6 z-10">
            <ShimmerButton onClick={() => setShowModal(true)} className="px-4 py-2 text-[10px]">
              + Register coworker
            </ShimmerButton>
          </div>
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
              className="relative bg-[#080808] border border-[#1f1f1f] w-full max-w-sm mx-4 overflow-hidden"
            >
              <BorderBeam size={200} duration={6} colorFrom="#39ff14" colorTo="#00f0ff" />
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
                <ShimmerButton
                  type="submit"
                  disabled={!form.github_username.trim() || creating}
                  className="w-full py-2.5 disabled:opacity-40"
                >
                  {creating ? "Building constitution..." : "Build + Register"}
                </ShimmerButton>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
