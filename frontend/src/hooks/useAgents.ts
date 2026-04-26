"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/types";

const DEMO_AGENTS: Agent[] = [
  {
    id: "alice",
    github_username: "alicechen",
    name: "Alice Chen",
    role: "Senior Backend Engineer",
    constitution_facts: [
      { subject: "alice", predicate: "owns", object: "auth/", category: "code_ownership", confidence: 0.95 },
      { subject: "alice", predicate: "owns", object: "billing/", category: "code_ownership", confidence: 0.9 },
      { subject: "alice", predicate: "expertise_in", object: "Go", category: "expertise", confidence: 0.95 },
      { subject: "alice", predicate: "expertise_in", object: "Kafka", category: "expertise", confidence: 0.88 },
      { subject: "alice", predicate: "expertise_in", object: "Distributed Systems", category: "expertise", confidence: 0.9 },
      { subject: "alice", predicate: "prefers", object: "Async communication, needs full context before meetings", category: "collaboration", confidence: 0.85 },
      { subject: "alice", predicate: "currently_working_on", object: "Payment retry logic refactor", category: "current_focus", confidence: 0.85 },
      { subject: "alice", predicate: "is_aware_of", object: "Auth token race condition under concurrent load in auth/token.go", category: "known_issues", confidence: 0.92 },
    ],
    github_data_summary: {
      commit_count: 312,
      pr_count: 47,
      top_files: ["auth/token.go", "billing/invoice.go", "auth/middleware.go"],
      languages: ["Go", "Python", "Bash"],
    },
  },
  {
    id: "bob",
    github_username: "bobpark",
    name: "Bob Park",
    role: "Full-Stack Engineer",
    constitution_facts: [
      { subject: "bob", predicate: "owns", object: "api/users/", category: "code_ownership", confidence: 0.9 },
      { subject: "bob", predicate: "owns", object: "frontend/", category: "code_ownership", confidence: 0.85 },
      { subject: "bob", predicate: "expertise_in", object: "TypeScript", category: "expertise", confidence: 0.92 },
      { subject: "bob", predicate: "expertise_in", object: "React", category: "expertise", confidence: 0.88 },
      { subject: "bob", predicate: "expertise_in", object: "REST APIs", category: "expertise", confidence: 0.85 },
      { subject: "bob", predicate: "prefers", object: "Short messages, quick syncs over long docs", category: "collaboration", confidence: 0.8 },
      { subject: "bob", predicate: "currently_working_on", object: "User profile redesign, changed auth middleware in PR #44", category: "current_focus", confidence: 0.88 },
    ],
    github_data_summary: {
      commit_count: 228,
      pr_count: 31,
      top_files: ["api/users/auth_middleware.go", "frontend/src/App.tsx", "api/users/handlers.go"],
      languages: ["TypeScript", "Go", "CSS"],
    },
  },
  {
    id: "carol",
    github_username: "carolzhang",
    name: "Carol Zhang",
    role: "Infrastructure Engineer",
    constitution_facts: [
      { subject: "carol", predicate: "owns", object: "infra/", category: "code_ownership", confidence: 0.92 },
      { subject: "carol", predicate: "owns", object: "deploy/", category: "code_ownership", confidence: 0.9 },
      { subject: "carol", predicate: "expertise_in", object: "Kubernetes", category: "expertise", confidence: 0.93 },
      { subject: "carol", predicate: "expertise_in", object: "Terraform", category: "expertise", confidence: 0.9 },
      { subject: "carol", predicate: "expertise_in", object: "CI/CD", category: "expertise", confidence: 0.88 },
      { subject: "carol", predicate: "prefers", object: "Formal runbooks, async Slack updates", category: "collaboration", confidence: 0.82 },
    ],
    github_data_summary: {
      commit_count: 189,
      pr_count: 24,
      top_files: ["infra/k8s/auth-deploy.yaml", "deploy/Dockerfile", "infra/terraform/main.tf"],
      languages: ["HCL", "YAML", "Bash"],
    },
  },
];

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetched = await api.getAgents();
      const list = Array.isArray(fetched) ? fetched : [];
      setAgents(list.length > 0 ? list : DEMO_AGENTS);
    } catch {
      setAgents(DEMO_AGENTS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { agents, isLoading, error, refetch, setAgents };
}
