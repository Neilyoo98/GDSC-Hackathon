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
