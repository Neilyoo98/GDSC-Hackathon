import type { Agent, IncidentResult, SSEEvent, StreamLike } from "./types";

const BASE = "/api";
const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockAgents: Agent[] = [
  {
    id: "a1b2c3d4",
    github_username: "tidwall",
    name: "Josh Baker",
    role: "Core Infrastructure",
    constitution_facts: [
      { subject: "tidwall", predicate: "owns", object: "src/btree/, src/index/", confidence: 0.95, category: "code_ownership" },
      { subject: "tidwall", predicate: "expertise_in", object: "Go, embedded databases, B-tree algorithms", confidence: 0.92, category: "expertise" },
      { subject: "tidwall", predicate: "prefers", object: "detailed issue descriptions before async discussion", confidence: 0.8, category: "collaboration" },
      { subject: "tidwall", predicate: "currently_working_on", object: "concurrent write optimization", confidence: 0.88, category: "current_focus" },
      { subject: "tidwall", predicate: "is_aware_of_issue", object: "index fragmentation under sustained write load", confidence: 0.72, category: "known_issues" }
    ],
    github_data_summary: {
      commit_count: 142,
      pr_count: 23,
      top_files: ["payment/retry/", "src/btree/", "src/index/"],
      languages: ["Go"]
    }
  },
  {
    id: "b5f9e8a1",
    github_username: "mitsuhiko",
    name: "Armin Ronacher",
    role: "Platform Runtime",
    constitution_facts: [
      { subject: "mitsuhiko", predicate: "owns", object: "auth/session/, gateway/middleware/", confidence: 0.9, category: "code_ownership" },
      { subject: "mitsuhiko", predicate: "expertise_in", object: "Python, APIs, auth middleware, observability", confidence: 0.91, category: "expertise" },
      { subject: "mitsuhiko", predicate: "prefers", object: "short repros, concrete logs, then decisive patches", confidence: 0.86, category: "collaboration" },
      { subject: "mitsuhiko", predicate: "currently_working_on", object: "mobile token refresh failure handling", confidence: 0.84, category: "current_focus" },
      { subject: "mitsuhiko", predicate: "is_aware_of_issue", object: "stale mobile auth tokens after deploys", confidence: 0.89, category: "known_issues" }
    ],
    github_data_summary: {
      commit_count: 98,
      pr_count: 31,
      top_files: ["auth/session/", "gateway/middleware/", "api/errors/"],
      languages: ["Python", "Rust"]
    }
  },
  {
    id: "c9d7a0e2",
    github_username: "kennethreitz",
    name: "Kenneth Reitz",
    role: "Developer Experience",
    constitution_facts: [
      { subject: "kennethreitz", predicate: "owns", object: "checkout/client/, api/http/", confidence: 0.87, category: "code_ownership" },
      { subject: "kennethreitz", predicate: "expertise_in", object: "HTTP clients, Python SDKs, resilient interfaces", confidence: 0.88, category: "expertise" },
      { subject: "kennethreitz", predicate: "prefers", object: "human-readable summaries with clean next actions", confidence: 0.82, category: "collaboration" },
      { subject: "kennethreitz", predicate: "currently_working_on", object: "checkout timeout budget tuning", confidence: 0.81, category: "current_focus" },
      { subject: "kennethreitz", predicate: "is_aware_of_issue", object: "Redis pool exhaustion in checkout workers", confidence: 0.85, category: "known_issues" }
    ],
    github_data_summary: {
      commit_count: 76,
      pr_count: 17,
      top_files: ["checkout/client/", "api/http/", "redis/pool/"],
      languages: ["Python"]
    }
  }
];

const mockResult: IncidentResult = {
  slack_message:
    "I am taking the payment 500s. The retry path is the likely blast radius based on the recent concurrency changes. I am checking retry queue depth, duplicate charge guards, and the deploy diff now. Please hold customer-facing updates until I confirm whether rollback is safer than patch-forward.",
  postmortem:
    "## Incident: Payment service 500s\n\n### Timeline\n- 00:00: Alert fired for elevated 500s.\n- 00:02: Ownership router matched payment/retry to primary maintainer.\n- 00:04: Agent context identified recent retry-loop work as likely contributor.\n\n### Root Cause\nTBD after log and deploy-diff review.\n\n### Impact\nCheckout failures and delayed payment confirmation for affected requests.\n\n### Action Items\n- [ ] Josh Baker - inspect retry queue depth and duplicate charge safeguards.\n- [ ] Platform Runtime - verify gateway error propagation.\n- [ ] Developer Experience - prepare customer-facing incident summary.",
  owners: ["a1b2c3d4"],
  stream_log: []
};

class MockIncidentSource implements StreamLike {
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(incidentText: string) {
    const events: SSEEvent[] = [
      { node: "incident_analyzer", status: "running", output: null },
      {
        node: "incident_analyzer",
        status: "done",
        output: {
          affected_service: incidentText.toLowerCase().includes("auth") ? "auth" : "payment",
          affected_files: incidentText.toLowerCase().includes("auth") ? ["auth/session/"] : ["payment/retry/"],
          error_type: incidentText.toLowerCase().includes("timeout") ? "timeout" : "500",
          urgency: "P1"
        }
      },
      { node: "ownership_router", status: "running", output: null },
      { node: "ownership_router", status: "done", output: { owners: ["a1b2c3d4"], confidence: 0.91 } },
      { node: "agent_querier", status: "running", output: null, agent: "Josh Baker" },
      {
        node: "agent_querier",
        status: "done",
        agent: "Josh Baker",
        output: {
          agent_name: "Josh Baker",
          context: "In domain. Recent constitution facts point to retry-loop work and index pressure during concurrent writes."
        }
      },
      { node: "response_drafter", status: "running", output: null },
      {
        node: "response_drafter",
        status: "done",
        output: {
          slack_message: mockResult.slack_message,
          postmortem: mockResult.postmortem
        }
      },
      { node: "memory_updater", status: "running", output: null },
      { node: "memory_updater", status: "done", output: { updated: ["a1b2c3d4"] } },
      { node: "complete", status: "done", output: null }
    ];

    events.forEach((event, index) => {
      const timer = setTimeout(() => {
        this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent<string>);
      }, 500 + index * 650);
      this.timers.push(timer);
    });
  }

  close() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  async getAgents(): Promise<Agent[]> {
    if (DEV_MODE) {
      await wait(300);
      return mockAgents;
    }
    return fetchJson<Agent[]>(`${BASE}/agents`);
  },

  async getAgent(id: string): Promise<Agent> {
    if (DEV_MODE) {
      await wait(200);
      return mockAgents.find((agent) => agent.id === id) ?? mockAgents[0];
    }
    return fetchJson<Agent>(`${BASE}/agents/${id}`);
  },

  async createAgent(body: { github_username: string; name?: string; role?: string }): Promise<Agent> {
    if (DEV_MODE) {
      await wait(700);
      return {
        id: Math.random().toString(16).slice(2, 10),
        github_username: body.github_username,
        name: body.name || body.github_username,
        role: body.role || "Software Engineer",
        constitution_facts: [],
        github_data_summary: { commit_count: 0, pr_count: 0, top_files: [], languages: [] }
      };
    }
    return fetchJson<Agent>(`${BASE}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  },

  async runIncident(incident_text: string): Promise<IncidentResult> {
    if (DEV_MODE) {
      await wait(900);
      return mockResult;
    }
    return fetchJson<IncidentResult>(`${BASE}/incidents/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incident_text })
    });
  },

  streamIncident(incident_text: string): StreamLike {
    if (DEV_MODE) {
      return new MockIncidentSource(incident_text);
    }
    return new EventSource(`${BASE}/incidents/stream?incident_text=${encodeURIComponent(incident_text)}`);
  }
};
