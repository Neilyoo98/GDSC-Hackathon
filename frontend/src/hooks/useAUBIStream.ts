"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AUBIEvent, AgentMessage } from "@/lib/types";

export function useAUBIStream(issueUrl: string | null) {
  const [events, setEvents] = useState<AUBIEvent[]>([]);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, "idle" | "running" | "done">>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const reset = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
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
