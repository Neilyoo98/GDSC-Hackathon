"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AUBIEvent, AgentMessage } from "@/lib/types";

const mockMessages: AgentMessage[] = [
  {
    sender: "orchestrator",
    recipient: "alice_aubi",
    message: "New issue: auth 401 blocking student submissions. Is this in your area?",
    timestamp: 0
  },
  {
    sender: "alice_aubi",
    recipient: "orchestrator",
    message: "Yes. This matches the race condition in auth/token.go from my constitution. Check concurrent cache reads and writes.",
    timestamp: 1
  },
  {
    sender: "orchestrator",
    recipient: "bob_aubi",
    message: "Bob, did PR #44 touch adjacent auth middleware?",
    timestamp: 2
  },
  {
    sender: "bob_aubi",
    recipient: "orchestrator",
    message: "Yes. It changed header passing in api/users/auth_middleware.go. Alice still owns the token cache fix.",
    timestamp: 3
  }
];

export function useAUBIStream(issueUrl: string | null) {
  const [events, setEvents] = useState<AUBIEvent[]>([]);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, "idle" | "running" | "done">>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const mockTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const reset = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    mockTimersRef.current.forEach(clearTimeout);
    mockTimersRef.current = [];
    setEvents([]);
    setAgentMessages([]);
    setNodeStatuses({});
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    reset();
    if (!issueUrl) return;

    setIsStreaming(true);
    const source = new EventSource(`/api/incidents/stream?issue_url=${encodeURIComponent(issueUrl)}`);
    eventSourceRef.current = source;

    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as AUBIEvent;
        setEvents((current) => [...current, event]);
        if (event.event === "node_start") {
          setNodeStatuses((current) => ({ ...current, [event.node]: "running" }));
        }
        if (event.event === "node_done") {
          setNodeStatuses((current) => ({ ...current, [event.node]: "done" }));
        }
        if (event.event === "agent_message") {
          setAgentMessages((current) => [...current, event.data]);
        }
        if (event.event === "complete") {
          source.close();
          setIsStreaming(false);
        }
      } catch {
        setEvents((current) => [...current, { event: "error", data: { message: "Failed to parse SSE event" } }]);
      }
    };

    source.onerror = () => {
      setEvents((current) => [...current, { event: "error", data: { message: "SSE connection failed" } }]);
      source.close();
      setIsStreaming(false);
    };

    return reset;
  }, [issueUrl, reset]);

  return { events, agentMessages, nodeStatuses, isStreaming, reset };
}
