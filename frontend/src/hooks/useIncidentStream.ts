"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { IncidentResult, SSEEvent, StreamLike } from "@/lib/types";

function normalizeResult(event: SSEEvent, current: IncidentResult | null): IncidentResult | null {
  if (event.node !== "response_drafter" || event.status !== "done" || !event.output) {
    return current;
  }

  const slack = event.output.slack_message ?? event.output.slack_msg;
  const postmortem = event.output.postmortem;
  if (typeof slack !== "string" && typeof postmortem !== "string") {
    return current;
  }

  return {
    slack_message: typeof slack === "string" ? slack : current?.slack_message ?? "",
    postmortem: typeof postmortem === "string" ? postmortem : current?.postmortem ?? "",
    owners: current?.owners ?? [],
    stream_log: current?.stream_log ?? []
  };
}

export function useIncidentStream() {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [result, setResult] = useState<IncidentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<StreamLike | null>(null);
  const startedAtRef = useRef<number>(0);

  const reset = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    setEvents([]);
    setResult(null);
    setError(null);
    setIsStreaming(false);
    startedAtRef.current = 0;
  }, []);

  const start = useCallback((incidentText: string) => {
    reset();
    setIsStreaming(true);
    startedAtRef.current = Date.now();

    const source = api.streamIncident(incidentText);
    sourceRef.current = source;

    source.onmessage = (message) => {
      try {
        const parsed = JSON.parse(message.data) as SSEEvent;
        const enriched: SSEEvent = {
          ...parsed,
          receivedAt: Date.now() - startedAtRef.current
        };
        setEvents((current) => [...current, enriched]);
        setResult((current) => normalizeResult(enriched, current));
        if (enriched.node === "complete") {
          source.close();
          setIsStreaming(false);
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Could not parse SSE event";
        setError(detail);
        setEvents((current) => [
          ...current,
          { node: "error", status: "error", output: { message: detail }, receivedAt: Date.now() - startedAtRef.current }
        ]);
      }
    };

    source.onerror = () => {
      const detail = "SSE connection failed";
      setError(detail);
      setEvents((current) => [
        ...current,
        { node: "error", status: "error", output: { message: detail }, receivedAt: Date.now() - startedAtRef.current }
      ]);
      source.close();
      setIsStreaming(false);
    };
  }, [reset]);

  useEffect(() => {
    return () => {
      sourceRef.current?.close();
    };
  }, []);

  return { events, isStreaming, result, error, start, reset, setResult };
}
