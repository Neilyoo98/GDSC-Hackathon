import type { Agent, ConstitutionCategory, ConstitutionFact } from "./types";

export const CONSTITUTION_CATEGORIES: Array<{
  key: ConstitutionCategory;
  label: string;
  color: string;
}> = [
  { key: "code_ownership", label: "Code Ownership", color: "#e8e4dc" },
  { key: "expertise", label: "Expertise", color: "#e8e4dc" },
  { key: "collaboration", label: "Collaboration", color: "#e8e4dc" },
  { key: "current_focus", label: "Current Focus", color: "#39ff14" },
  { key: "known_issues", label: "Known Issues", color: "#e8e4dc" }
];

export function factsFor(agent: Agent | null | undefined, category: ConstitutionCategory): ConstitutionFact[] {
  if (!agent) return [];
  const grouped = agent.constitution?.[category];
  if (Array.isArray(grouped)) return grouped;
  return agent.constitution_facts?.filter((fact) => fact.category === category) ?? [];
}

export function factObjects(agent: Agent, category: ConstitutionCategory, max = 3): string[] {
  return factsFor(agent, category)
    .map((fact) => fact.object)
    .filter(Boolean)
    .slice(0, max);
}

export function collaborationBlurb(agent: Agent): string {
  return factsFor(agent, "collaboration")[0]?.object ?? "No collaboration preference indexed yet.";
}

export function shortRole(role: string): string {
  return role.length > 28 ? `${role.slice(0, 25)}...` : role;
}

export function coworkerName(agent: Agent): string {
  const source = agent.name || agent.github_username || "Developer";
  const rawBase = source.split(/[\s-]+/).find(Boolean) ?? source;
  const base = rawBase ? rawBase.charAt(0).toUpperCase() + rawBase.slice(1) : "Developer";
  return `${base}-AUBI`;
}

export function coworkerPossessiveName(agent: Agent): string {
  const source = agent.name || agent.github_username || "Developer";
  const rawBase = source.split(/[\s-]+/).find(Boolean) ?? source;
  const base = rawBase ? rawBase.charAt(0).toUpperCase() + rawBase.slice(1) : "Developer";
  return `${base}${base.toLowerCase().endsWith("s") ? "'" : "'s"} AUBI`;
}

export function humanSourceLabel(agent: Agent): string {
  return `for @${agent.github_username}`;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function identityKey(agent: Agent): string {
  const subject = agent.constitution_facts?.find((fact) => fact.subject)?.subject;
  const value = agent.github_username || agent.name || subject || agent.id;
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function factKey(fact: ConstitutionFact): string {
  return [
    fact.category,
    fact.subject,
    fact.predicate,
    fact.object,
  ].join("|").toLowerCase();
}

function mergeStrings(left: string[], right: string[]): string[] {
  return Array.from(new Set([...left, ...right].filter(Boolean)));
}

function groupFacts(facts: ConstitutionFact[]): Partial<Record<ConstitutionCategory, ConstitutionFact[]>> {
  return facts.reduce<Partial<Record<ConstitutionCategory, ConstitutionFact[]>>>((acc, fact) => {
    acc[fact.category] = [...(acc[fact.category] ?? []), fact];
    return acc;
  }, {});
}

function recordScore(agent: Agent): number {
  return (
    agent.constitution_facts.length * 10 +
    agent.github_data_summary.top_files.length * 3 +
    agent.github_data_summary.languages.length * 2 +
    agent.github_data_summary.commit_count +
    agent.github_data_summary.pr_count
  );
}

function mergeAgents(left: Agent, right: Agent): Agent {
  const primary = recordScore(right) > recordScore(left) ? right : left;
  const secondary = primary === left ? right : left;
  const factMap = new Map<string, ConstitutionFact>();
  [...secondary.constitution_facts, ...primary.constitution_facts].forEach((fact) => {
    factMap.set(factKey(fact), fact);
  });
  const facts = Array.from(factMap.values());

  return {
    ...primary,
    role: primary.role || secondary.role,
    name: primary.name || secondary.name,
    github_username: primary.github_username || secondary.github_username,
    constitution_facts: facts,
    constitution: groupFacts(facts),
    github_data_summary: {
      commit_count: Math.max(primary.github_data_summary.commit_count, secondary.github_data_summary.commit_count),
      pr_count: Math.max(primary.github_data_summary.pr_count, secondary.github_data_summary.pr_count),
      top_files: mergeStrings(primary.github_data_summary.top_files, secondary.github_data_summary.top_files),
      languages: mergeStrings(primary.github_data_summary.languages, secondary.github_data_summary.languages),
    },
  };
}

export function normalizeAgent(agent: Agent): Agent {
  const summary = agent.github_data_summary ?? {};

  return {
    ...agent,
    constitution_facts: Array.isArray(agent.constitution_facts) ? agent.constitution_facts : [],
    github_data_summary: {
      commit_count: numberValue(summary.commit_count),
      pr_count: numberValue(summary.pr_count),
      top_files: stringArray(summary.top_files),
      languages: stringArray(summary.languages)
    }
  };
}

export function normalizeAgents(agents: Agent[]): Agent[] {
  if (!Array.isArray(agents)) return [];
  const byIdentity = new Map<string, Agent>();
  agents.map(normalizeAgent).forEach((agent) => {
    const key = identityKey(agent) || agent.id;
    const existing = byIdentity.get(key);
    byIdentity.set(key, existing ? mergeAgents(existing, agent) : agent);
  });
  return Array.from(byIdentity.values());
}
