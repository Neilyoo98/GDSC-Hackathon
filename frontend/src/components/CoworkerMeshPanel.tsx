"use client";

import { motion } from "framer-motion";
import type {
  Agent,
  CoworkerContextExchange,
  IncidentResult,
  MemoryUpdate,
  SSEEvent,
  SharedMemoryHit,
} from "@/lib/types";

function text(value: unknown, fallback = "pending"): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function coworkerName(value: unknown, agents: Agent[]): string {
  const raw = text(value, "AUBI coworker");
  const agent = agents.find((a) => a.id === raw || a.github_username === raw || a.name === raw);
  return agent ? `${agent.name} AUBI` : raw;
}

function contextText(exchange: CoworkerContextExchange): string {
  return text(exchange.shared_context ?? exchange.context ?? exchange.summary ?? exchange.message, "Waiting for shared context...");
}

function sourceName(exchange: CoworkerContextExchange, agents: Agent[]): string {
  return coworkerName(exchange.requester_aubi ?? exchange.source_aubi ?? exchange.sender ?? exchange.from, agents);
}

function targetName(exchange: CoworkerContextExchange, agents: Agent[]): string {
  return coworkerName(exchange.responder_aubi ?? exchange.target_aubi ?? exchange.recipient ?? exchange.to, agents);
}

function memorySummary(memory: SharedMemoryHit): string {
  const fact = Array.isArray(memory.evidence_facts) ? memory.evidence_facts[0] : undefined;
  if (fact) {
    return text(fact.object ?? fact.summary ?? fact.content, "Team memory matched");
  }
  return text(memory.memory ?? memory.content ?? memory.summary ?? memory.title, "Team memory matched");
}

function memorySource(memory: SharedMemoryHit): string {
  return text(memory.agent_name ?? memory.source ?? memory.agent_id, "Shared team memory");
}

function updateText(update: MemoryUpdate): string {
  return text(update.update ?? update.episode ?? update.memory ?? update.fact ?? update.object, "Memory written after incident");
}

function updateOwner(update: MemoryUpdate, agents: Agent[]): string {
  return coworkerName(update.coworker_aubi ?? update.agent_name ?? update.agent_id ?? update.subject, agents);
}

function derivedExchange(result: IncidentResult | null, agents: Agent[]): CoworkerContextExchange[] {
  if (result?.coworker_contexts?.length) return result.coworker_contexts;

  const routed = result?.routing_evidence?.[0];
  if (!routed) return [];

  const agentId = text(routed.agent_id, "");
  const agentName = text(routed.agent_name, agentId);
  const agentContext = result?.agent_messages?.find((msg) => msg.sender !== "orchestrator")?.message;
  const target = agentName || agents.find((a) => a.id === agentId)?.name;

  return [{
    requester_aubi: "Incident router AUBI",
    responder_aubi: target ? `${target} AUBI` : "Owner AUBI",
    reason: "Ownership and expertise memory matched this incident.",
    shared_context: agentContext ?? "Awaiting owner coworker context...",
  }];
}

function derivedSharedMemory(result: IncidentResult | null): SharedMemoryHit[] {
  if (result?.shared_memory?.length) return result.shared_memory;
  return (result?.routing_evidence ?? []).map((evidence) => evidence as SharedMemoryHit);
}

function derivedUpdates(result: IncidentResult | null): MemoryUpdate[] {
  if (result?.memory_updates?.length) return result.memory_updates;
  return (result?.learned_facts ?? []).map((fact) => fact as MemoryUpdate);
}

function eventCount(events: SSEEvent[], type: string): number {
  return events.filter((event) => event.eventType === type).length;
}

export function CoworkerMeshPanel({
  result,
  agents,
  events,
}: {
  result: IncidentResult | null;
  agents: Agent[];
  events: SSEEvent[];
}) {
  const exchanges = derivedExchange(result, agents);
  const memories = derivedSharedMemory(result).slice(0, 3);
  const updates = derivedUpdates(result).slice(0, 3);
  const hasSignal = exchanges.length > 0 || memories.length > 0 || updates.length > 0;

  return (
    <section className="border border-[#1e2d45] bg-[#0a0e1a] rounded p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] text-[#4a6080] tracking-widest">{"// COWORKER MESH"}</p>
          <p className="mt-1 text-xs text-[#8aa0c0]">AUBI coworkers exchange context and learn from the incident.</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {[
            ["CTX", "coworker_context"],
            ["MEM", "shared_memory"],
            ["WRITE", "memory_update"],
          ].map(([label, type]) => (
            <span
              key={type}
              className="rounded border border-[#1e2d45] px-2 py-1 font-mono text-[9px] text-[#4a6080]"
            >
              {label} {eventCount(events, type)}
            </span>
          ))}
        </div>
      </div>

      {!hasSignal && (
        <div className="rounded border border-dashed border-[#1e2d45] px-3 py-3 font-mono text-[10px] leading-relaxed text-[#4a6080]">
          Waiting for coworker context, shared memory, and memory writes.
        </div>
      )}

      {exchanges.length > 0 && (
        <div className="space-y-2">
          {exchanges.slice(0, 3).map((exchange, index) => (
            <motion.div
              key={`${sourceName(exchange, agents)}-${targetName(exchange, agents)}-${index}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded border border-violet-500/20 bg-violet-500/5 p-3"
            >
              <p className="font-mono text-[10px] text-violet-300">
                {sourceName(exchange, agents)} asked {targetName(exchange, agents)}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#8aa0c0]">
                Why: {text(exchange.reason ?? exchange.why, "relevant ownership context")}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#c8d6e8]">{contextText(exchange)}</p>
            </motion.div>
          ))}
        </div>
      )}

      {memories.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 font-mono text-[9px] text-[#4a6080] tracking-widest">{"// SHARED TEAM MEMORY USED"}</p>
          <div className="space-y-2">
            {memories.map((memory, index) => (
              <div key={`${memorySource(memory)}-${index}`} className="rounded border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
                <p className="font-mono text-[10px] text-cyan-300">{memorySource(memory)}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#8aa0c0]">{memorySummary(memory)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {updates.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 font-mono text-[9px] text-[#4a6080] tracking-widest">{"// MEMORY WRITTEN"}</p>
          <div className="space-y-2">
            {updates.map((update, index) => (
              <div key={`${updateOwner(update, agents)}-${index}`} className="rounded border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <p className="font-mono text-[10px] text-emerald-300">{updateOwner(update, agents)}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#8aa0c0]">{updateText(update)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
