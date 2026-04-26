"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AUBIEvent, AgentMessage } from "@/lib/types";

export function useAUBIStream(issueUrl: string | null) {
  const [events, setEvents] = useState<AUBIEvent[]>([]);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, "idle" | "running" | "done">>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const closeSource = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  const applyEvent = useCallback((event: AUBIEvent) => {
    setEvents((current) => [...current, event]);

    if (event.event === "node_start") {
      const statusNode = event.node === "query_single_agent" || event.node === "agent_querier" ? "query_agents" : event.node;
      setNodeStatuses((current) => ({ ...current, [statusNode]: "running" }));
    }
    if (event.event === "node_done") {
      const statusNode = event.node === "query_single_agent" || event.node === "agent_querier" ? "query_agents" : event.node;
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
    if (event.event === "error") {
      const message = typeof event.data === "string" ? event.data : event.data?.message;
      setError(message ?? "Backend stream failed");
      setIsStreaming(false);
    }
  }, []);

  const reset = useCallback(() => {
    closeSource();
    setEvents([]);
    setAgentMessages([]);
    setNodeStatuses({});
    setIsStreaming(false);
    setError(null);
  }, [closeSource]);

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
          source.close();
          setIsStreaming(false);
        }
      } catch {
        setError("Failed to parse SSE event");
        setEvents((current) => [...current, { event: "error", data: { message: "Failed to parse SSE event" } }]);
        source.close();
        setIsStreaming(false);
      }
    };

    source.onerror = () => {
      setError("SSE connection failed");
      setEvents((current) => [...current, { event: "error", data: { message: "SSE connection failed" } }]);
      source.close();
      setIsStreaming(false);
    };

    return reset;
  }, [applyEvent, issueUrl, reset]);

  return { events, agentMessages, nodeStatuses, isStreaming, error, reset };
}
