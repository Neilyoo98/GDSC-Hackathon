"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/types";

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setAgents(await api.getAgents());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { agents, isLoading, error, refetch, setAgents };
}
