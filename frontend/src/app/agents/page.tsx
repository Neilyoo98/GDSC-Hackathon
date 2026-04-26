"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useAgents } from "@/hooks/useAgents";
import { DossierPanel } from "@/components/DossierPanel";
import { api } from "@/lib/api";
import { coworkerName } from "@/lib/agents";
import type { Agent } from "@/lib/types";

// react-force-graph-2d uses canvas — must be client-only
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const CAT_COLORS: Record<string, string> = {
  code_ownership: "#39ff14",
  expertise:      "#e8e4dc",
  collaboration:  "#8b5cf6",
  current_focus:  "#f59e0b",
  known_issues:   "#ff3366",
};
const CATS = Object.keys(CAT_COLORS);

// ── Connection logic ───────────────────────────────────────────────────────
function agentTokens(agent: Agent): Set<string> {
  const out = new Set<string>();
  for (const fact of agent.constitution_facts ?? []) {
    if (["code_ownership", "current_focus", "known_issues"].includes(fact.category)) {
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

// ── Avatar image cache for canvas rendering ────────────────────────────────
const imgCache: Record<string, HTMLImageElement> = {};
function loadAvatar(username: string): HTMLImageElement {
  if (imgCache[username]) return imgCache[username];
  const img = new window.Image();
  img.crossOrigin = "anonymous";
  img.src = `https://github.com/${username}.png?size=128`;
  imgCache[username] = img;
  return img;
}

export default function AgentsPage() {
  const { agents, isLoading, setAgents } = useAgents();
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [showModal,  setShowModal]      = useState(false);
  const [form,       setForm]           = useState({ github_username: "", name: "", role: "" });
  const [creating,   setCreating]       = useState(false);
  const [createError,setCreateError]    = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims]                 = useState({ w: 900, h: 600 });
  const graphRef = useRef<any>(null);

  // Track selected in a ref so canvas callbacks always see latest value
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  // Measure container
  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setDims({ w: containerRef.current.offsetWidth, h: containerRef.current.offsetHeight });
      }
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const agentList = useMemo(() => (Array.isArray(agents) ? agents : []), [agents]);
  const selectedAgent = agentList.find((a) => a.id === selectedId) ?? null;

  // Build force-graph data
  const graphData = useMemo(() => {
    const nodes = agentList.map((a) => ({ id: a.id, agent: a }));
    const links: { source: string; target: string }[] = [];
    for (let i = 0; i < agentList.length; i++) {
      for (let j = i + 1; j < agentList.length; j++) {
        if (connected(agentList[i], agentList[j])) {
          links.push({ source: agentList[i].id, target: agentList[j].id });
        }
      }
    }
    return { nodes, links };
  }, [agentList]);

  const connectionCount = graphData.links.length;

  // Pre-load avatars whenever agents change
  useEffect(() => {
    agentList.forEach((a) => loadAvatar(a.github_username || a.name));
  }, [agentList]);

  // ── Canvas node painter ──────────────────────────────────────────────────
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const agent: Agent = node.agent;
    if (!agent) return;
    const x: number = node.x ?? 0;
    const y: number = node.y ?? 0;
    const R = 30;
    const isSelected = selectedIdRef.current === agent.id;
    const facts = agent.constitution_facts ?? [];
    const SEG = (Math.PI * 2) / CATS.length;

    // Selected outer pulse ring
    if (isSelected) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, R + 16, 0, Math.PI * 2);
      ctx.strokeStyle = "#39ff14";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.restore();
    }

    // Constitution arcs (outer ring per category)
    CATS.forEach((cat, ci) => {
      const count  = facts.filter((f) => f.category === cat).length;
      const filled = Math.min(count / 3, 1);
      if (!filled) return;
      const arcR       = R + 8;
      const startAngle = ci * SEG - Math.PI / 2 - 0.05;
      const endAngle   = startAngle + SEG * filled * 0.82;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, arcR, startAngle, endAngle);
      ctx.strokeStyle = CAT_COLORS[cat];
      ctx.lineWidth   = 3.5;
      ctx.lineCap     = "round";
      ctx.globalAlpha = isSelected ? 1 : 0.8;
      ctx.shadowColor  = CAT_COLORS[cat];
      ctx.shadowBlur   = 6;
      ctx.stroke();
      ctx.restore();
    });

    // Clip avatar into circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#111";
    ctx.fill();

    const username = agent.github_username || agent.name;
    const img      = loadAvatar(username);
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x - R, y - R, R * 2, R * 2);
    } else {
      // Placeholder initials
      ctx.fillStyle  = "#1f1f1f";
      ctx.fill();
      ctx.font       = `bold ${R * 0.6}px sans-serif`;
      ctx.fillStyle  = "#39ff14";
      ctx.textAlign  = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((agent.name ?? "?")[0].toUpperCase(), x, y);
    }
    ctx.restore();

    // Border ring
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.strokeStyle = isSelected ? "#39ff14" : "#2a2a2a";
    ctx.lineWidth   = isSelected ? 2.5 : 1.5;
    if (isSelected) {
      ctx.shadowColor = "#39ff14";
      ctx.shadowBlur  = 10;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Name label
    const label    = coworkerName(agent).toUpperCase();
    const fontSize = Math.max(8, 11 / globalScale);
    ctx.font       = `${fontSize}px 'Space Mono', monospace`;
    ctx.fillStyle  = isSelected ? "#39ff14" : "#e8e4dc";
    ctx.textAlign  = "center";
    ctx.textBaseline = "top";
    ctx.fillText(label, x, y + R + 7);

    // Role label
    const role = (agent.role ?? "").split(/[,·]/)[0].trim().slice(0, 20);
    if (role && globalScale > 0.6) {
      ctx.font      = `${Math.max(7, 9 / globalScale)}px 'Space Mono', monospace`;
      ctx.fillStyle = "#e8e4dc55";
      ctx.fillText(role, x, y + R + 7 + fontSize + 3);
    }
  }, []);

  // Click area shape matches node size
  const paintPointer = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    ctx.arc(node.x ?? 0, node.y ?? 0, 36, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedId((prev) => (prev === node.id ? null : node.id as string));
  }, []);

  const handleEngineStop = useCallback(() => {
    graphRef.current?.zoomToFit(600, 100);
  }, []);

  // ── Form handlers ────────────────────────────────────────────────────────
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

      {/* ── Main canvas ─────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden" ref={containerRef}>

        {/* Subtle grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(#e8e4dc 1px,transparent 1px),linear-gradient(90deg,#e8e4dc 1px,transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        {/* Top bar */}
        <div className="absolute top-6 left-6 z-10 pointer-events-none">
          <p className="font-mono text-[9px] uppercase tracking-[4px] text-[#39ff14]">{"// COWORKER MESH"}</p>
          <h1 className="font-syne text-3xl font-normal text-[#e8e4dc] mt-1">AUBI Coworkers</h1>
          <p className="font-mono text-[10px] text-[#e8e4dc44] mt-1">
            {agentList.length} coworker{agentList.length !== 1 ? "s" : ""} · {connectionCount} connection{connectionCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Status indicator */}
        <div className="absolute top-6 right-6 z-10 flex items-center gap-2 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-pulse" />
          <span className="font-mono text-[9px] uppercase tracking-[3px] text-[#39ff14]">Mesh Online</span>
        </div>

        {/* Force graph or empty states */}
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="font-mono text-[10px] uppercase tracking-[4px] text-[#39ff1466]">
              Loading coworker mesh...
            </p>
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
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dims.w}
            height={dims.h}
            backgroundColor="#080808"
            // Node rendering
            nodeCanvasObject={paintNode}
            nodeCanvasObjectMode={() => "replace"}
            nodePointerAreaPaint={paintPointer}
            nodeLabel={() => ""}
            onNodeClick={handleNodeClick}
            // Edge styling
            linkColor={() => "#39ff1430"}
            linkWidth={1.5}
            // Flowing particles along edges — the money shot
            linkDirectionalParticles={4}
            linkDirectionalParticleColor={() => "#39ff14"}
            linkDirectionalParticleWidth={3}
            linkDirectionalParticleSpeed={0.006}
            // Physics
            d3AlphaDecay={0.018}
            d3VelocityDecay={0.3}
            cooldownTicks={150}
            onEngineStop={handleEngineStop}
            // Warm up so it settles before user sees it
            warmupTicks={60}
          />
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

        {/* Constitution legend */}
        <div className="absolute bottom-6 right-6 z-10 border border-[#1f1f1f] bg-[#080808cc] px-3 py-2.5 backdrop-blur-sm">
          <p className="font-mono text-[8px] uppercase tracking-[3px] text-[#e8e4dc44] mb-2">{"// constitution"}</p>
          <div className="flex flex-col gap-1.5">
            {Object.entries(CAT_COLORS).map(([key, color]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
                <span className="font-mono text-[9px] uppercase tracking-[1px] text-[#e8e4dc66]">
                  {key.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <p className="font-mono text-[9px] text-[#e8e4dc22] tracking-[2px]">
            click a node · drag to explore · scroll to zoom
          </p>
        </div>
      </div>

      {/* ── Dossier panel ───────────────────────────────────────────────── */}
      <div
        className={[
          "flex-shrink-0 transition-all duration-300 overflow-hidden border-l border-[#1f1f1f]",
          selectedAgent ? "w-[360px]" : "w-0",
        ].join(" ")}
      >
        <DossierPanel agent={selectedAgent} onClose={() => setSelectedId(null)} onDelete={handleDelete} />
      </div>

      {/* ── Register modal ───────────────────────────────────────────────── */}
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
                <span className="font-mono text-[9px] uppercase tracking-[3px] text-[#e8e4dc66]">
                  {"// register coworker"}
                </span>
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
