"use client";

import { motion } from "framer-motion";
import { coworkerPossessiveName } from "@/lib/agents";
import type { Agent, AgentMessage, GitHubIssue, IncidentResult, SSEEvent } from "@/lib/types";

type BoardMessage = {
  from: string;
  to: string;
  body: string;
  tone: "human" | "agent" | "memory";
};

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function normalized(value: string): string {
  return value
    .toLowerCase()
    .replace(/@/g, "")
    .replace(/['’]s\b/g, "")
    .replace(/\baubi\b/g, "")
    .replace(/[_\s-]+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function findAgent(value: unknown, agents: Agent[]): Agent | undefined {
  if (typeof value !== "string") return undefined;
  const raw = normalized(value);
  return agents.find((agent) => {
    const candidates = [agent.id, agent.github_username, agent.name, `${agent.github_username}_aubi`, `${agent.name}_aubi`];
    return candidates.some((candidate) => {
      const key = normalized(candidate ?? "");
      return key && (raw === key || raw.includes(key) || key.includes(raw));
    });
  });
}

function label(value: unknown, agents: Agent[]): string {
  if (typeof value !== "string" || !value.trim()) return "AUBI";
  if (value.toLowerCase() === "orchestrator") return "AUBI Orchestrator";
  const agent = findAgent(value, agents);
  if (agent) return coworkerPossessiveName(agent);
  return value.replace(/[_-]?aubi$/i, "'s AUBI").replace(/[_-]+/g, " ");
}

function eventMessages(events: SSEEvent[]): AgentMessage[] {
  return events
    .filter((event) => event.eventType === "agent_message" && event.output)
    .map((event) => event.output as unknown as AgentMessage);
}

function dedupeMessages(messages: AgentMessage[]): AgentMessage[] {
  const seen = new Set<string>();
  return messages.filter((message) => {
    const key = `${message.sender}|${message.recipient}|${message.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildBoardMessages(result: IncidentResult | null, events: SSEEvent[], agents: Agent[], issue: GitHubIssue | null): BoardMessage[] {
  const board: BoardMessage[] = [];
  if (issue) {
    board.push({
      from: text(issue.author ?? issue.user, "Human"),
      to: "AUBI Orchestrator",
      body: `${issue.repo_name}#${issue.issue_number}: ${issue.title}`,
      tone: "human",
    });
  }

  dedupeMessages([...(result?.agent_messages ?? []), ...eventMessages(events)]).forEach((message) => {
    board.push({
      from: label(message.sender, agents),
      to: label(message.recipient, agents),
      body: text(message.message, "Shared incident context"),
      tone: message.sender.toLowerCase() === "orchestrator" || message.recipient.toLowerCase() === "orchestrator" ? "agent" : "memory",
    });
  });

  if (result?.awaiting_approval) {
    board.push({
      from: "AUBI Orchestrator",
      to: "Human reviewer",
      body: "Patch is ready for approval before AUBI pushes the PR.",
      tone: "human",
    });
  }

  return board;
}

function metric(label: string, value: number | string) {
  return { label, value };
}

export function ProcessDashboard({
  result,
  events,
  agents,
  latestIssue,
  isStreaming,
}: {
  result: IncidentResult | null;
  events: SSEEvent[];
  agents: Agent[];
  latestIssue: GitHubIssue | null;
  isStreaming: boolean;
}) {
  const messages = buildBoardMessages(result, events, agents, latestIssue).slice(-6);
  const memories = result?.shared_memory_hits ?? result?.shared_memory ?? [];
  const writes = result?.memory_writes ?? result?.memory_updates ?? [];
  const metrics = [
    metric("messages", messages.length),
    metric("memory hits", memories.length),
    metric("writes", writes.length),
    metric("status", result?.pr_url ? "PR" : result?.awaiting_approval ? "approval" : isStreaming ? "running" : "idle"),
  ];
  const impacts = [
    result?.owners?.length ? `Ownership narrowed to ${result.owners.length} coworker${result.owners.length === 1 ? "" : "s"}.` : "",
    memories.length ? `${memories.length} shared memory record${memories.length === 1 ? "" : "s"} influenced routing/context.` : "",
    typeof result?.tests_passed === "boolean" ? `Verification ${result.tests_passed ? "passed" : "failed"} before human approval.` : "",
    writes.length ? `${writes.length} new memory write${writes.length === 1 ? "" : "s"} queued from this incident.` : "",
  ].filter(Boolean);

  return (
    <section className="rounded border border-[#1e2d45] bg-[#0a0e1a] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] tracking-widest text-[#4a6080]">{"// PROCESS DASHBOARD"}</p>
          <p className="mt-1 text-xs text-[#8aa0c0]">Human signals, coworker messages, and memory impact in the live run.</p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-1.5">
          {metrics.map((item) => (
            <div key={item.label} className="rounded border border-[#1e2d45] px-2 py-1 text-right">
              <p className="font-mono text-[10px] text-[#c8d6e8]">{item.value}</p>
              <p className="font-mono text-[8px] uppercase tracking-[1.5px] text-[#4a6080]">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {messages.length === 0 ? (
          <div className="rounded border border-dashed border-[#1e2d45] px-3 py-3 font-mono text-[10px] leading-relaxed text-[#4a6080]">
            Start an incident to populate the human/coworker message board.
          </div>
        ) : (
          messages.map((message, index) => (
            <motion.div
              key={`${message.from}-${message.to}-${index}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={[
                "rounded border px-3 py-2",
                message.tone === "human"
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : message.tone === "memory"
                    ? "border-cyan-500/20 bg-cyan-500/5"
                    : "border-violet-500/20 bg-violet-500/5",
              ].join(" ")}
            >
              <p className="font-mono text-[10px] text-[#8aa0c0]">
                {message.from} → {message.to}
              </p>
              <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-[#c8d6e8]">{message.body}</p>
            </motion.div>
          ))
        )}
      </div>

      {impacts.length > 0 && (
        <div className="mt-3 grid gap-2">
          {impacts.map((impact) => (
            <div key={impact} className="rounded border border-[#1e2d45] bg-[#111827] px-3 py-2 font-mono text-[10px] leading-relaxed text-[#8aa0c0]">
              {impact}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
