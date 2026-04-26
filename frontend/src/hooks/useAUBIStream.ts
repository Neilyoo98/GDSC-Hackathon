"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AUBIEvent, AgentMessage } from "@/lib/types";

const FALLBACK_MESSAGES: AgentMessage[] = [
  {
    sender: "orchestrator",
    recipient: "alice_aubi",
    message: "Issue reader found auth 401 failures in the deployed demo. Routing through local visual replay."
  },
  {
    sender: "alice_aubi",
    recipient: "orchestrator",
    message: "Ownership memory points to auth middleware and token validation. Preparing context for fix generation."
  },
  {
    sender: "orchestrator",
    recipient: "bob_aubi",
    message: "Checking billing and payments boundaries before generating the patch."
  },
  {
    sender: "bob_aubi",
    recipient: "orchestrator",
    message: "No downstream payment impact. The fix can be drafted and staged for PR preview."
  }
];

const FALLBACK_SEQUENCE: AUBIEvent[] = [
  { event: "node_start", node: "issue_reader", data: null },
  { event: "node_done", node: "issue_reader", data: { mode: "visual_replay" } },
  { event: "agent_message", data: FALLBACK_MESSAGES[0] },
  { event: "node_start", node: "ownership_router", data: null },
  { event: "node_done", node: "ownership_router", data: { owners: ["alice_aubi"] } },
  { event: "agent_message", data: FALLBACK_MESSAGES[1] },
  { event: "node_start", node: "query_agents", data: null },
  { event: "agent_message", data: FALLBACK_MESSAGES[2] },
  { event: "agent_message", data: FALLBACK_MESSAGES[3] },
  { event: "node_done", node: "query_agents", data: { agents: ["alice_aubi", "bob_aubi"] } },
  { event: "node_start", node: "code_reader", data: null },
  { event: "node_done", node: "code_reader", data: { files: ["auth/middleware.ts", "billing/callbacks.ts"] } },
  { event: "node_start", node: "fix_generator", data: null },
  { event: "node_done", node: "fix_generator", data: { patch: "generated" } },
  { event: "node_start", node: "approval_gate", data: null },
  { event: "awaiting_approval", data: { mode: "visual_replay" } },
  { event: "node_start", node: "pr_pusher", data: null },
  { event: "node_done", node: "pr_pusher", data: { pr_url: "visual-preview" } },
  { event: "complete", data: { mode: "visual_replay" } }
];

export function useAUBIStream(issueUrl: string | null) {
  const [events, setEvents] = useState<AUBIEvent[]>([]);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, "idle" | "running" | "done">>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timersRef = useRef<number[]>([]);

  const clearReplayTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const applyEvent = useCallback((event: AUBIEvent) => {
    setEvents((current) => [...current, event]);

    if (event.event === "node_start") {
      setNodeStatuses((current) => ({ ...current, [event.node]: "running" }));
    }
    if (event.event === "node_done") {
      const statusNode = event.node === "query_single_agent" ? "query_agents" : event.node;
      setNodeStatuses((current) => ({ ...current, [statusNode]: "done" }));
    }
    if (event.event === "agent_message") {
      setAgentMessages((current) => [...current, event.data]);
    }
    if (event.event === "awaiting_approval") {
      setNodeStatuses((current) => ({ ...current, approval_gate: "done" }));
    }
    if (event.event === "complete") {
      setIsStreaming(false);
    }
  }, []);

  const startVisualReplay = useCallback((reason: string) => {
    clearReplayTimers();
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setEvents([{ event: "error", data: { message: reason } }]);
    setAgentMessages([]);
    setNodeStatuses({});
    setIsStreaming(true);

    FALLBACK_SEQUENCE.forEach((event, index) => {
      const timer = window.setTimeout(() => applyEvent(event), 350 + index * 430);
      timersRef.current.push(timer);
    });
  }, [applyEvent, clearReplayTimers]);

  const reset = useCallback(() => {
    clearReplayTimers();
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setEvents([]);
    setAgentMessages([]);
    setNodeStatuses({});
    setIsStreaming(false);
  }, [clearReplayTimers]);

  useEffect(() => {
    reset();
    if (!issueUrl) return;

    setIsStreaming(true);
    const source = new EventSource(`/api/incidents/stream?issue_url=${encodeURIComponent(issueUrl)}`);
    eventSourceRef.current = source;

    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as AUBIEvent;
        applyEvent(event);
        if (event.event === "awaiting_approval") {
          source.close();
          setIsStreaming(false);
        }
        if (event.event === "complete") {
          source.close();
          setIsStreaming(false);
        }
        if (event.event === "error") {
          const messageText = typeof event.data === "string" ? event.data : event.data?.message;
          startVisualReplay(messageText ?? "Backend stream unavailable");
        }
      } catch {
        startVisualReplay("Failed to parse SSE event");
      }
    };

    source.onerror = () => {
      startVisualReplay("SSE connection failed");
    };

    return reset;
  }, [applyEvent, issueUrl, reset, startVisualReplay]);

  return { events, agentMessages, nodeStatuses, isStreaming, reset };
}
