"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAgents } from "@/hooks/useAgents";
import { HexGrid } from "@/components/HexGrid";
import { DossierPanel } from "@/components/DossierPanel";
import { api } from "@/lib/api";

export default function AgentsPage() {
  const { agents, isLoading, refetch, setAgents } = useAgents();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ github_username: "", name: "", role: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const selectedAgent = agents.find((a) => a.id === selectedId) ?? null;

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
      {/* Hex grid */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <svg width={60} height={60} viewBox="-30 -30 60 60">
                <motion.circle cx={0} cy={0} r={24} fill="none" stroke="#1e2d45" strokeWidth={2}
                  animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
                <circle cx={0} cy={0} r={3} fill="#4a6080" />
              </svg>
              <p className="font-mono text-[10px] text-[#4a6080] tracking-widest">LOADING AGENT MESH...</p>
            </div>
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
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
            <div className="absolute top-5 left-6 z-10">
              <p className="font-syne text-xl text-white">Agents</p>
              <p className="font-mono text-[10px] text-[#4a6080] mt-0.5">
                {agents.length} agent{agents.length !== 1 ? "s" : ""} in mesh
              </p>
            </div>
            <HexGrid
              agents={agents}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAddAgent={() => setShowModal(true)}
            />
          </>
        )}
      </div>

      {/* Dossier panel */}
      <div
        className={[
          "flex-shrink-0 transition-all duration-300 overflow-hidden",
          selectedAgent ? "w-[360px]" : "w-0",
        ].join(" ")}
      >
        <DossierPanel agent={selectedAgent} onClose={() => setSelectedId(null)} />
      </div>

      {/* Add agent modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0d1224] border border-[#1e2d45] rounded-lg w-full max-w-sm mx-4 overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d45]">
                <span className="font-mono text-[10px] text-[#4a6080] tracking-widest">// REGISTER AGENT</span>
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
                {createError && (
                  <p className="font-mono text-[10px] text-[#ff3366]">{createError}</p>
                )}
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
