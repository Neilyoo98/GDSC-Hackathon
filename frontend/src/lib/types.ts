export type ConstitutionCategory =
  | "code_ownership"
  | "expertise"
  | "collaboration"
  | "current_focus"
  | "known_issues"
  | "episodes";

export interface ConstitutionFact {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  category: ConstitutionCategory;
}

export interface Agent {
  id: string;
  github_username: string;
  name: string;
  role: string;
  constitution_facts: ConstitutionFact[];
  github_data_summary: {
    commit_count: number;
    pr_count: number;
    top_files: string[];
    languages: string[];
  };
}

export type SSENode =
  | "incident_analyzer"
  | "ownership_router"
  | "agent_querier"
  | "response_drafter"
  | "memory_updater"
  | "complete"
  | "error";

export interface SSEEvent {
  node: SSENode;
  status: "running" | "done" | "error";
  output: Record<string, unknown> | null;
  agent?: string;
  receivedAt?: number;
}

export interface IncidentResult {
  slack_message: string;
  postmortem: string;
  owners: string[];
  stream_log: string[];
}

export interface StreamLike {
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: ((event: Event) => void) | null;
  close: () => void;
}
