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

export interface CoworkerContextExchange {
  requester_aubi?: string;
  responder_aubi?: string;
  source_aubi?: string;
  target_aubi?: string;
  sender?: string;
  recipient?: string;
  from?: string;
  to?: string;
  reason?: string;
  why?: string;
  context?: string;
  shared_context?: string;
  summary?: string;
  message?: string;
  related_files?: string[];
  timestamp?: number | string;
}

export interface SharedMemoryHit {
  agent_id?: string;
  agent_name?: string;
  source?: string;
  title?: string;
  memory?: string;
  content?: string;
  summary?: string;
  relevance?: string;
  score?: number;
  confidence?: number;
  matched_files?: string[];
  evidence_facts?: Record<string, unknown>[];
}

export interface MemoryUpdate {
  agent_id?: string;
  agent_name?: string;
  coworker_aubi?: string;
  update?: string;
  episode?: string;
  memory?: string;
  fact?: string;
  subject?: string;
  predicate?: string;
  object?: string;
  category?: string;
  confidence?: number;
}

export interface GitHubIssue {
  url: string;
  html_url?: string;
  repo_name: string;
  issue_number: number;
  title: string;
  body?: string;
  author?: string;
  user?: string;
  created_at?: string;
  updated_at?: string;
  labels?: string[];
}

export interface GitHubPollResult {
  issue: GitHubIssue | null;
}

export type AUBIEvent =
  | { event: "thread"; data: Record<string, unknown> | null }
  | { event: "node_start"; node: string; data: null }
  | { event: "node_done"; node: string; data: Record<string, unknown> | null }
  | { event: "agent_message"; data: AgentMessage }
  | { event: "routing_evidence"; data: Record<string, unknown> }
  | { event: "coworker_context"; data: CoworkerContextExchange }
  | { event: "shared_memory"; data: SharedMemoryHit }
  | { event: "memory_update"; data: MemoryUpdate }
  | { event: "aubi_learned"; data: Record<string, unknown> }
  | { event: "awaiting_approval"; data: Record<string, unknown> }
  | { event: "complete"; data: Record<string, unknown> | null }
  | { event: "error"; data: string | { message: string } };

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
  eventType?: string;
  node: SSENode;
  status: "running" | "done" | "error";
  output: Record<string, unknown> | null;
  agent?: string;
  receivedAt?: number;
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
  coworker_contexts?: CoworkerContextExchange[];
  shared_memory?: SharedMemoryHit[];
  memory_updates?: MemoryUpdate[];
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
