"use client";

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Code, Users, Cpu, Globe, GitBranch } from "lucide-react";
import { useAgents } from "@/hooks/useAgents";
import { DossierPanel } from "@/components/DossierPanel";
import { InteractiveBackground } from "@/components/InteractiveBackground";
import RadialOrbitalTimeline, { RING_CATEGORIES } from "@/components/ui/radial-orbital-timeline";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/types";

// Pick an icon based on an agent's top language/role
function agentIcon(agent: Agent) {
  const langs = agent.github_data_summary.languages.join(" ").toLowerCase();
  const role  = agent.role.toLowerCase();
  if (langs.includes("go") || role.includes("backend"))  return Code;
  if (langs.includes("typescript") || langs.includes("react")) return Globe;
  if (role.includes("infra") || role.includes("devops")) return Cpu;
  if (role.includes("full"))                              return GitBranch;
  return Users;
}

// Agents that share files are "related"
function shareFiles(a: Agent, b: Agent) {
  const prefix = (f: string) => f.split("/")[0] + "/";
  const aSet = new Set(a.github_data_summary.top_files.map(prefix));
  return b.github_data_summary.top_files.some((f) => aSet.has(prefix(f)));
}

export default function AgentsPage() {
  const { agents, isLoading, setAgents } = useAgents();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ github_username: "", name: "", role: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const selectedAgent = agents.find((a) => a.id === selectedId) ?? null;

  // Map agents → orbital timeline items
  const timelineData = useMemo(() => agents.map((agent, i) => {
    const relIds: number[] = [];
    agents.forEach((other, j) => {
      if (j !== i && shareFiles(agent, other)) relIds.push(j + 1);
    });

    const factCount  = agent.constitution_facts.length;
    const energy     = Math.min(100, Math.round((factCount / 8) * 100));
    const topExpert  = agent.constitution_facts.find(f => f.category === "expertise")?.object ?? "";
    const focus      = agent.constitution_facts.find(f => f.category === "current_focus")?.object ?? agent.role;
    const knownIssue = agent.constitution_facts.find(f => f.category === "known_issues")?.object;

    const content = [
      topExpert && `Expertise: ${topExpert}.`,
      focus && `Focus: ${focus}.`,
      knownIssue && `Known: ${knownIssue}.`,
    ].filter(Boolean).join(" ") || agent.role;

    const status: "completed" | "in-progress" | "pending" =
      factCount >= 6 ? "completed" : factCount >= 3 ? "in-progress" : "pending";

    const constitutionCounts = agent.constitution_facts.reduce<Record<string, number>>((acc, f) => {
      acc[f.category] = (acc[f.category] ?? 0) + 1;
      return acc;
    }, {});

    return {
      id: i + 1,
      agentId: agent.id,
      title: agent.name.split(" ")[0],
      date: `@${agent.github_username}`,
      content,
      category: agent.role,
      icon: agentIcon(agent),
      relatedIds: relIds,
      status,
      energy,
      avatarUrl: `https://github.com/${agent.github_username}.png?size=80`,
      constitutionCounts,
    };
  }), [agents]);

  // Center label: connection count
  const connectionCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < agents.length; i++)
      for (let j = i + 1; j < agents.length; j++)
        if (shareFiles(agents[i], agents[j])) count++;
    return count;
  }, [agents]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.github_username.trim()) return;
    setCreating(true);
    setCreateError(null);
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

  return (
    <div className="flex h-[calc(100vh-52px)]">
      {/* Main area */}
      <div className="flex-1 relative overflow-hidden">
        <InteractiveBackground />

        {isLoading ? (
          <div className="flex items-center justify-center h-full relative z-10">
            <div className="flex flex-col items-center gap-3">
              <motion.div
                className="w-8 h-8 rounded-full border-2 border-[#00f0ff] border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              />
              <p className="font-mono text-[10px] text-[#4a6080] tracking-widest">LOADING AGENT MESH...</p>
            </div>
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 relative z-10">
            <p className="font-mono text-[13px] text-[#2a3f5f]">NO AGENTS REGISTERED</p>
            <button
              onClick={() => setShowModal(true)}
              className="font-mono text-xs text-[#00f0ff] border border-[#1e2d45] bg-[#0d1224] px-5 py-2.5 rounded hover:border-[#00f0ff44]"
            >
              + REGISTER FIRST AGENT
            </button>
          </div>
        ) : (
          <>
            {/* Page title */}
            <div className="absolute top-5 left-6 z-10 pointer-events-none">
              <p className="font-syne text-xl text-white">Agents</p>
              <p className="font-mono text-[10px] text-[#4a6080] mt-0.5">
                {agents.length} agent{agents.length !== 1 ? "s" : ""} · {connectionCount} connection{connectionCount !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Orbital timeline — full area */}
            <div className="absolute inset-0 z-10">
              <RadialOrbitalTimeline
                timelineData={timelineData}
                centerLabel="MESH"
                centerSublabel={`${connectionCount} links`}
                onSelect={(id) => setSelectedId(id)}
              />
            </div>

            {/* Register button */}
            <button
              onClick={() => setShowModal(true)}
              className="absolute bottom-6 left-6 z-20 font-mono text-xs text-[#00f0ff] border border-[#1e2d45] bg-[#0d1224]/80 px-4 py-2 rounded transition-all hover:border-[#00f0ff44] hover:bg-[#0d1230]"
            >
              + REGISTER AGENT
            </button>

            {/* Ring legend */}
            <div className="absolute bottom-6 right-6 z-20 bg-[#0d1224]/80 border border-[#1e2d45] rounded-md px-3 py-2.5 backdrop-blur-sm">
              <p className="font-mono text-[8px] text-[#4a6080] tracking-[0.15em] mb-2">{"// RING KEY"}</p>
              <div className="flex flex-col gap-1.5">
                {RING_CATEGORIES.map((cat) => (
                  <div key={cat.key} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color, boxShadow: `0 0 5px ${cat.color}99` }}
                    />
                    <span className="font-mono text-[9px] text-[#8aa0c0]">{cat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* System online */}
            <div className="absolute top-5 right-6 z-20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[9px] text-[#4a6080] tracking-widest">SYSTEM ONLINE</span>
            </div>
          </>
        )}
      </div>

      {/* Dossier panel */}
      <div className={["flex-shrink-0 transition-all duration-300 overflow-hidden", selectedAgent ? "w-[360px]" : "w-0"].join(" ")}>
        <DossierPanel agent={selectedAgent} onClose={() => setSelectedId(null)} />
      </div>

      {/* Register agent modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0d1224] border border-[#1e2d45] rounded-lg w-full max-w-sm mx-4 overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d45]">
                <span className="font-mono text-[10px] text-[#4a6080] tracking-widest">{"// REGISTER AGENT"}</span>
                <button onClick={() => setShowModal(false)} className="text-[#4a6080] hover:text-white">×</button>
              </div>
              <form onSubmit={handleCreate} className="p-5 space-y-4">
                {[
                  { key: "github_username", label: "GITHUB USERNAME *", placeholder: "e.g. tidwall" },
                  { key: "name", label: "DISPLAY NAME", placeholder: "optional" },
                  { key: "role", label: "ROLE", placeholder: "e.g. Core Infrastructure" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block font-mono text-[9px] text-[#4a6080] tracking-wider mb-1.5">{label}</label>
                    <input
                      type="text"
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full bg-[#0a0e1a] border border-[#1e2d45] rounded px-3 py-2 font-mono text-[12px] text-[#e2e8f0] placeholder-[#2a3f5f] focus:outline-none focus:border-[#00f0ff44]"
                    />
                  </div>
                ))}
                {createError && <p className="font-mono text-[10px] text-[#ff3366]">{createError}</p>}
                <button
                  type="submit"
                  disabled={!form.github_username.trim() || creating}
                  className="w-full py-2.5 font-mono font-bold text-[12px] tracking-wider text-[#0a0e1a] bg-[#00f0ff] rounded disabled:opacity-40 transition-opacity"
                  style={{ boxShadow: "0 0 12px #00f0ff40" }}
                >
                  {creating ? "BUILDING CONSTITUTION..." : "BUILD + REGISTER"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
