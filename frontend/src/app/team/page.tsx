"use client";

import { useMemo, useState } from "react";
import type { Agent } from "@/lib/types";
import { useAgents } from "@/hooks/useAgents";
import { AgentCard } from "@/components/aubi/AgentCard";
import { ConstitutionPanel } from "@/components/aubi/ConstitutionPanel";

export default function TeamPage() {
  const { agents, isLoading, error } = useAgents();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const visibleAgents = useMemo(() => agents, [agents]);

  return (
    <div className="relative min-h-[calc(100vh-52px)] overflow-hidden px-6 py-6">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc99]">{"// TEAM CONSTITUTIONS"}</p>
          <h1 className="mt-2 font-syne text-6xl font-normal leading-none text-[#e8e4dc]">AUBI Coworker Mesh</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#e8e4dc99]">
            Persistent AUBI coworkers, each backed by a Context Constitution of ownership, expertise, collaboration style, and known issues.
          </p>
        </div>
        <div className="border border-[#e8e4dc33] px-4 py-2 font-mono text-[10px] uppercase tracking-[2px] text-[#39ff14]">
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[#39ff14]" />
          Mesh Online
        </div>
      </div>

      {error && (
        <div className="mb-4 border border-[#e8e4dc33] p-4 font-mono text-[11px] uppercase tracking-[2px] text-[#e8e4dc99]">
          Backend unavailable. Showing demo agent memory.
        </div>
      )}

      {isLoading ? (
        <div className="flex h-[424px] items-center justify-center font-mono text-sm uppercase tracking-[3px] text-[#e8e4dc66]">
          Loading Coworker Mesh...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-4">
          {visibleAgents.map((agent, index) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              index={index}
              selected={selectedAgent?.id === agent.id}
              onSelect={setSelectedAgent}
            />
          ))}
        </div>
      )}

      <div className="mt-8 border border-[#e8e4dc33] bg-[#080808] p-4">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc99]">{"// READINESS CHECKPOINT"}</div>
        <div className="grid gap-4 font-mono text-[11px] uppercase tracking-[2px] text-[#e8e4dc99] md:grid-cols-4">
          <div className="border border-[#1f1f1f] p-4">1. Coworker cards show persona, role, expertise, ownership, and style.</div>
          <div className="border border-[#1f1f1f] p-4">2. Click any card to inspect full constitution facts.</div>
          <div className="border border-[#1f1f1f] p-4">3. Memory v3 badges confirm persistent profile state.</div>
        </div>
      </div>

      <ConstitutionPanel agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
    </div>
  );
}
