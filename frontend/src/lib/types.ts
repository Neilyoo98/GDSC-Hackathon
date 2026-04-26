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
  constitution?: Partial<Record<ConstitutionCategory, ConstitutionFact[]>>;
  github_data_summary: {
    commit_count: number;
    pr_count: number;
    top_files: string[];
    languages: string[];
  };
}

export interface AgentMessage {
  sender: "orchestrator" | "alice_aubi" | "bob_aubi" | "carol_aubi" | string;
  recipient: "orchestrator" | "alice_aubi" | "bob_aubi" | "carol_aubi" | string;
  message: string;
  timestamp?: number;
}

export type AUBIEvent =
  | { event: "node_start"; node: string; data: null }
  | { event: "node_done"; node: string; data: Record<string, unknown> | null }
  | { event: "agent_message"; data: AgentMessage }
  | { event: "complete"; data: null }
  | { event: "error"; data: { message: string } };

export type SSENode =
  | "thread"
  | "issue_reader"
  | "incident_analyzer"
  | "ownership_router"
  | "query_single_agent"
  | "agent_querier"
  | "code_reader"
  | "fix_generator"
  | "test_runner"
  | "approval_gate"
  | "pr_pusher"
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

export interface AgentMessage {
  sender: string;
  recipient: string;
  message: string;
  timestamp: number;
}

export interface IncidentResult {
  thread_id?: string;
  awaiting_approval?: boolean;
  approval?: Record<string, unknown>;
  pr_url?: string;
  patch_diff?: string;
  fix_explanation?: string;
  test_output?: string;
  tests_passed?: boolean;
  owners: string[];
  agent_messages?: AgentMessage[];
  routing_evidence?: Record<string, unknown>[];
  learned_facts?: Record<string, unknown>[];
  stream_log: string[];
}

export interface ApprovalResult {
  thread_id: string;
  approved: boolean;
  pr_url?: string;
  patch_diff?: string;
  fix_explanation?: string;
  test_output?: string;
  tests_passed?: boolean;
  learned_facts?: Record<string, unknown>[];
  stream_log?: string[];
}

export interface StreamLike {
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: ((event: Event) => void) | null;
  close: () => void;
}
