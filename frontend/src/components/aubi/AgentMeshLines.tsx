"use client";

import { motion } from "framer-motion";
import type { AUBIEvent, AgentMessage } from "@/lib/types";

type Position = { x: number; y: number; label: string; description: string; role: "orchestrator" | "coworker" };

function endpointKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "aubi";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function stripAUBISuffix(value: string) {
  return value
    .replace(/[_-]?aubi$/i, "")
    .replace(/\s+aubi$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

function isCrypticId(value: string) {
  const compact = value.replace(/[^a-z0-9]/gi, "");
  return /^[a-f0-9]{7,}$/i.test(compact) || /^[a-z0-9]{12,}$/i.test(compact);
}

function titleName(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function coworkerLabel(baseName: string) {
  const name = titleName(stripAUBISuffix(baseName));
  if (!name || isCrypticId(name)) return "Selected Coworker's AUBI";
  return `${name}${name.toLowerCase().endsWith("s") ? "'" : "'s"} AUBI`;
}

function addAlias(directory: Map<string, string>, raw: unknown, displayName: unknown) {
  const rawValue = stringValue(raw);
  const displayValue = stringValue(displayName);
  if (!rawValue || !displayValue) return;
  const baseName = stripAUBISuffix(displayValue);
  if (!baseName || isCrypticId(baseName)) return;
  [rawValue, stripAUBISuffix(rawValue), `${rawValue}_aubi`, `${rawValue}-aubi`, displayValue, `${baseName}_aubi`, `${baseName}-aubi`]
    .filter(Boolean)
    .forEach((alias) => directory.set(endpointKey(alias), baseName));
}

function addAgentPairsFromRecord(directory: Map<string, string>, record: Record<string, unknown>) {
  addAlias(directory, record.agent_id, record.agent_name);
  addAlias(directory, record.requester_agent_id, record.requester_agent_name);
  addAlias(directory, record.responder_agent_id, record.responder_agent_name);
  addAlias(directory, record.source_aubi, record.requester_agent_name ?? record.agent_name);
  addAlias(directory, record.target_aubi, record.responder_agent_name ?? record.agent_name);

  const requesterIds = Array.isArray(record.requester_agent_ids) ? record.requester_agent_ids : [];
  const requesterNames = Array.isArray(record.requester_agent_names) ? record.requester_agent_names : [];
  requesterIds.forEach((id, index) => addAlias(directory, id, requesterNames[index]));

  const ownerIds = Array.isArray(record.owner_ids) ? record.owner_ids : [];
  const ownerNames = Array.isArray(record.owner_names) ? record.owner_names : [];
  ownerIds.forEach((id, index) => addAlias(directory, id, ownerNames[index]));
}

function addNestedRecords(directory: Map<string, string>, value: unknown, keys: string[]) {
  if (!isRecord(value)) return;
  keys.forEach((key) => {
    const nested = value[key];
    if (Array.isArray(nested)) {
      nested.filter(isRecord).forEach((record) => addAgentPairsFromRecord(directory, record));
    }
  });
}

function inferAliasesFromMessages(directory: Map<string, string>, messages: AgentMessage[]) {
  messages.forEach((message, index) => {
    const next = messages[index + 1];
    if (!next) return;

    const sentToCoworker = endpointKey(message.sender) === "orchestrator" && endpointKey(next.recipient) === "orchestrator";
    if (sentToCoworker) {
      addAlias(directory, message.recipient, next.sender);
    }

    const repliedToCoworker = endpointKey(message.recipient) === "orchestrator" && endpointKey(next.sender) === "orchestrator";
    if (repliedToCoworker) {
      addAlias(directory, message.sender, next.recipient);
    }
  });
}

function endpointDirectory(events: AUBIEvent[], messages: AgentMessage[]) {
  const directory = new Map<string, string>();

  events.forEach((event) => {
    if (!isRecord(event.data)) return;
    addAgentPairsFromRecord(directory, event.data);
    addNestedRecords(directory, event.data, [
      "agent_contexts",
      "routing_evidence",
      "coworker_exchanges",
      "coworker_contexts",
      "shared_memory_hits",
      "shared_memory",
      "memory_writes",
      "memory_updates",
    ]);
  });

  inferAliasesFromMessages(directory, messages);
  return directory;
}

function canonicalKey(value: string, directory: Map<string, string>) {
  const key = endpointKey(value);
  if (key === "orchestrator") return key;
  const displayName = directory.get(key);
  return displayName ? endpointKey(`${displayName}_aubi`) : key;
}

function endpointLabel(value: string, directory: Map<string, string>) {
  const key = endpointKey(value);
  if (key === "orchestrator") return "AUBI Orchestrator";
  const displayName = directory.get(key);
  if (displayName) return coworkerLabel(displayName);

  const cleaned = stripAUBISuffix(value);
  if (!cleaned || isCrypticId(cleaned)) return "Selected Coworker's AUBI";
  return coworkerLabel(cleaned);
}

function uniqueEndpoints(messages: AgentMessage[], activeMessage: AgentMessage | null | undefined, directory: Map<string, string>): Array<{ key: string; label: string }> {
  const values = [
    ...messages.flatMap((message) => [message.sender, message.recipient]),
    ...(activeMessage ? [activeMessage.sender, activeMessage.recipient] : []),
  ];
  const byKey = new Map<string, { key: string; label: string }>();
  values.forEach((value) => {
    const key = canonicalKey(value, directory);
    byKey.set(key, { key, label: endpointLabel(value, directory) });
  });
  return Array.from(byKey.values());
}

function positionsFor(endpoints: Array<{ key: string; label: string }>): Record<string, Position> {
  const positions: Record<string, Position> = {};
  const orchestrator = endpoints.find((endpoint) => endpoint.key === "orchestrator");
  const coworkers = endpoints.filter((endpoint) => endpoint.key !== "orchestrator");

  if (orchestrator) {
    positions.orchestrator = {
      x: 50,
      y: 50,
      label: orchestrator.label,
      description: "Routes the issue and coordinates context",
      role: "orchestrator",
    };
  }

  coworkers.forEach((endpoint, index) => {
    const count = Math.max(coworkers.length, 1);
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    const radius = orchestrator ? 32 : 28;
    positions[endpoint.key] = {
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
      label: endpoint.label,
      description: "Coworker context node",
      role: "coworker",
    };
  });

  return positions;
}

function edgesFor(messages: AgentMessage[], directory: Map<string, string>): Array<[string, string]> {
  const seen = new Set<string>();
  return messages.flatMap((message) => {
    const from = canonicalKey(message.sender, directory);
    const to = canonicalKey(message.recipient, directory);
    const key = [from, to].sort().join("-");
    if (from === to || seen.has(key)) return [];
    seen.add(key);
    return [[from, to] as [string, string]];
  });
}

export function AgentMeshLines({
  messages = [],
  activeMessage,
  events = [],
  className = "h-[224px]",
}: {
  messages?: AgentMessage[];
  activeMessage?: AgentMessage | null;
  events?: AUBIEvent[];
  className?: string;
}) {
  const directory = endpointDirectory(events, messages);
  const endpoints = uniqueEndpoints(messages, activeMessage, directory);
  const positions = positionsFor(endpoints);
  const edges = edgesFor(messages, directory);
  const senderKey = activeMessage ? canonicalKey(activeMessage.sender, directory) : "";
  const recipientKey = activeMessage ? canonicalKey(activeMessage.recipient, directory) : "";
  const sender = senderKey ? positions[senderKey] : null;
  const recipient = recipientKey ? positions[recipientKey] : null;
  const activeRoute =
    activeMessage && sender && recipient
      ? `${sender.label} -> ${recipient.label}`
      : endpoints.length > 0
        ? `${Math.max(endpoints.length - 1, 0)} coworker${endpoints.length === 2 ? "" : "s"} mapped`
        : "No message paths";

  if (endpoints.length === 0) {
    return (
      <div className={`relative flex items-center justify-center overflow-hidden border border-[#e8e4dc33] bg-[#080808] ${className}`}>
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc66]">Awaiting Coworker Mesh</p>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[2px] text-[#e8e4dc44]">Run a live issue to draw message paths</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden border border-[#e8e4dc33] bg-[#080808] ${className}`}>
      <div className="absolute left-4 top-4 z-10 max-w-[calc(100%-2rem)]">
        <p className="font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dc99]">{"// COWORKER MESSAGE MESH"}</p>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[2px] text-[#e8e4dc66]">{activeRoute}</p>
      </div>

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {edges.map(([from, to]) => {
          const a = positions[from];
          const b = positions[to];
          if (!a || !b) return null;
          const active =
            (sender === a && recipient === b) ||
            (sender === b && recipient === a);

          return (
            <g key={`${from}-${to}`}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={active ? "#39ff14" : "#1f1f1f"}
                strokeWidth={active ? 1.5 : 1}
                vectorEffect="non-scaling-stroke"
              />
              {active && (
                <motion.circle
                  r={1.1}
                  fill="#39ff14"
                  initial={{ opacity: 0 }}
                  animate={{ cx: [a.x, b.x], cy: [a.y, b.y], opacity: [0, 1, 0] }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {Object.entries(positions).map(([key, node]) => {
        const isSender = key === senderKey;
        const isRecipient = key === recipientKey;
        const active = isSender || isRecipient;
        return (
          <motion.div
            key={key}
            animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={{ duration: 0.8, repeat: active ? Infinity : 0, repeatDelay: 0.4 }}
            className="absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-center"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <span
              className={[
                "h-4 w-4 rounded-full border",
                node.role === "orchestrator" ? "h-5 w-5" : "",
                active ? "border-[#39ff14] bg-[#39ff14]" : "border-[#e8e4dc33] bg-[#080808]",
              ].join(" ")}
            />
            <span className={`font-mono text-[9px] uppercase leading-4 tracking-[1.5px] ${active ? "text-[#39ff14]" : "text-[#e8e4dc99]"}`}>
              {node.label}
            </span>
            <span className="font-mono text-[7px] uppercase tracking-[1.5px] text-[#e8e4dc55]">
              {isSender ? "sending" : isRecipient ? "receiving" : node.description}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
