import Link from "next/link";
import { JetBrains_Mono, Syne } from "next/font/google";

const syne = Syne({ subsets: ["latin"], weight: ["700", "800"] });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"] });

const steps = [
  {
    number: "01",
    title: "Issue detected",
    description: "A professor opens a GitHub issue without knowing which engineer owns the failing path.",
    tag: "issue_reader"
  },
  {
    number: "02",
    title: "Owner found",
    description: "AUBI routes the issue through ownership memory instead of Slack escalation.",
    tag: "ownership_router"
  },
  {
    number: "03",
    title: "Agents consulted",
    description: "The right AI co-workers surface known context from their Context Constitutions.",
    tag: "query_agents ∥",
    hot: true
  },
  {
    number: "04",
    title: "Fix generated",
    description: "The graph reads the source, applies the known bug pattern, and drafts a real patch.",
    tag: "fix_generator"
  },
  {
    number: "05",
    title: "PR pushed",
    description: "AUBI opens a GitHub PR with reviewers, issue linkage, and the owner’s communication style.",
    tag: "pr_pusher"
  }
];

const team = [
  {
    initial: "V",
    name: "Vitthal",
    domain: "Orchestration · Memory",
    description: "LangGraph graph, Claude prompts, Qdrant constitution store."
  },
  {
    initial: "N",
    name: "Neil",
    domain: "GitHub · Integrations",
    description: "Issue reader, code reader, PR pusher."
  },
  {
    initial: "A",
    name: "Avhaang",
    domain: "Frontend",
    description: "Agent cards, constitution viewer, comm feed."
  },
  {
    initial: "M",
    name: "Mitansh",
    domain: "Frontend",
    description: "Issue feed, code diff panel, PR preview, SSE wiring."
  }
];

const agents = [
  {
    name: "Alice Chen",
    role: "Senior Backend Engineer",
    facts: [
      ["owns", "auth/"],
      ["owns", "billing/"],
      ["expertise", "Go, Kafka, distributed systems"],
      ["known issue", "auth token race condition in auth/token.go"]
    ],
    meters: ["95% ownership", "92% confidence"]
  },
  {
    name: "Bob Park",
    role: "Platform Engineer",
    facts: [
      ["owns", "payments/"],
      ["owns", "infra/"],
      ["expertise", "Python, APIs, observability"],
      ["current focus", "adjacent auth middleware in PR #44"]
    ],
    meters: ["88% ownership", "84% confidence"]
  }
];

function IssueIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 18C6 8 18 16 18 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="6" cy="18" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="6" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function AgentsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="9" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="9" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 19c.8-3 2.2-4 4-4s3.2 1 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 19c.8-3 2.2-4 4-4s3.2 1 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FixIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m14 7 3 3-7 7H7v-3l7-7Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9 9 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PrIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="18" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 8v8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 6h4a6 6 0 0 1 6 6v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function HexNode() {
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" fill="none" aria-hidden="true">
      <path d="M56 8 98 32v48l-42 24-42-24V32L56 8Z" stroke="#f2f0ec" strokeOpacity=".22" strokeWidth="1" />
      <path d="M56 20 86 38v36L56 92 26 74V38l30-18Z" stroke="#7c6aff" strokeOpacity=".8" strokeWidth="1" />
      <circle cx="56" cy="56" r="16" fill="#7c6aff14" stroke="#7c6aff30" strokeWidth="1" />
    </svg>
  );
}

const pipelineNodes = [
  { label: "Issue Reader", state: "done", icon: <IssueIcon /> },
  { label: "Ownership Router", state: "done", icon: <RouteIcon /> },
  { label: "Query Agents ∥", state: "active", icon: <AgentsIcon /> },
  { label: "Fix Generator", state: "idle", icon: <FixIcon /> },
  { label: "PR Pusher", state: "idle", icon: <PrIcon /> }
];

export default function Home() {
  return (
    <div
      className="relative isolate overflow-hidden"
      style={
        {
          "--bg": "#07070d",
          "--text": "#f2f0ec",
          "--muted": "#55526a",
          "--mid": "#8a8699",
          "--purple": "#7c6aff",
          "--green": "#00e5a0",
          "--surface": "#0d0d12",
          "--border": "#ffffff0d",
          "--border-visible": "#ffffff18",
          background: "var(--bg)",
          color: "var(--text)",
          minHeight: "100vh"
        } as React.CSSProperties
      }
    >
      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: .5; }
          50% { opacity: 1; }
        }
        @keyframes slide {
          from { left: -100%; }
          to { left: 200%; }
        }
        @keyframes fadeup {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .lp-fade {
          opacity: 0;
          animation: fadeup .7s ease forwards;
          will-change: opacity, transform;
        }
        .lp-connector::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          width: 55%;
          background: linear-gradient(90deg, transparent, #7c6aff, transparent);
          animation: slide 2.4s linear infinite;
        }
      `}</style>

      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[96px] z-0 h-[320px] w-[520px] -translate-x-1/2 bg-[#7c6aff26] blur-[80px]" />
      <div aria-hidden="true" className="pointer-events-none absolute right-[-120px] top-[64px] z-0 h-[280px] w-[280px] bg-[#00e5a018] blur-[80px]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[220px] left-[-160px] z-0 h-[320px] w-[320px] bg-[#7c6aff18] blur-[80px]" />

      <div className="relative z-[2]">
        <nav className="flex h-14 items-center justify-between border-b border-[var(--border)] px-10">
          <div className="flex items-center gap-4">
            <span className={syne.className} style={{ fontWeight: 800, fontSize: 18, color: "var(--text)" }}>AUBI</span>
            <span className={mono.className} style={{ fontSize: 9, color: "#a594ff", background: "#7c6aff14", border: "1px solid #7c6aff30", borderRadius: 4, padding: "4px 8px" }}>
              GDSC 2026
            </span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            {["How it works", "Architecture", "Team"].map((item) => (
              <a key={item} href={item === "Architecture" ? "#architecture" : item === "Team" ? "#team" : "#how-it-works"} className="text-[13px] font-normal text-[#4a4857] transition-colors hover:text-[var(--text)]">
                {item}
              </a>
            ))}
          </div>
          <Link href="/demo" className="rounded-[7px] bg-[var(--text)] px-[18px] py-2 text-[13px] font-medium text-[var(--bg)]">
            View Demo →
          </Link>
        </nav>

        <section className="px-10 pb-20 pt-24 text-center">
          <div className="lp-fade mx-auto inline-flex items-center gap-3 rounded-full border border-[#7c6aff25] bg-[#7c6aff12] px-4 py-2" style={{ animationDelay: "0s" }}>
            <span className="h-[5px] w-[5px] rounded-full bg-[var(--green)]" style={{ animation: "breathe 2s ease-in-out infinite" }} />
            <span className={mono.className} style={{ fontSize: 10, color: "var(--text)" }}>Live at GDSC Hackathon · UMD · April 26</span>
          </div>

          <h1 className={`${syne.className} lp-fade mx-auto mt-8 max-w-[720px]`} style={{ animationDelay: ".1s", fontWeight: 800, fontSize: 68, letterSpacing: -2, lineHeight: 0.98 }}>
            Your codebase already knows <span style={{ background: "linear-gradient(135deg, #7c6aff, #00e5a0)", WebkitBackgroundClip: "text", color: "transparent" }}>who to call.</span>
          </h1>

          <p className="lp-fade mx-auto mt-6 max-w-[500px] text-[16px] font-light leading-[1.8] text-[#6b6880]" style={{ animationDelay: ".2s" }}>
            A GitHub issue drops. AUBI&apos;s agent mesh finds the right developer by memory, generates the fix, and pushes the PR. No Slack. No guessing. No human routing.
          </p>

          <div className="mt-8 flex justify-center gap-4">
            <Link href="/demo" className="rounded-lg bg-[var(--purple)] px-6 py-3 text-[14px] font-medium text-[var(--text)]">
              Watch the 90s demo
            </Link>
            <a href="#architecture" className="rounded-lg border border-[var(--border-visible)] bg-transparent px-6 py-3 text-[14px] font-medium text-[var(--mid)]">
              Read the architecture →
            </a>
          </div>

          <div className={`${mono.className} mt-6 flex flex-wrap items-center justify-center gap-3 text-[9px] uppercase text-[#3a3850]`}>
            {["Best Developer Tool", "Most Creative", "Best Use of Gemini", "Claude Sonnet · LangGraph · Qdrant"].map((tag, index) => (
              <span key={tag} className="flex items-center gap-3">
                {index > 0 && <span className="h-[3px] w-[3px] rounded-full bg-[#3a3850]" />}
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section id="architecture" className="mx-10 mb-16 overflow-hidden rounded-lg border border-[var(--border-visible)] bg-[var(--surface)]">
          <div className={`${mono.className} flex items-center justify-between border-b border-[var(--border)] px-6 py-4 text-[10px] text-[#3a3850]`}>
            <span>LangGraph Pipeline — Live Execution</span>
            <span className="text-[var(--green)]">● Running</span>
          </div>
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[#12121a] px-6 py-[14px]">
            <div className="flex items-center gap-4">
              <span className="h-2 w-2 rounded-full bg-[var(--purple)]" style={{ animation: "breathe 2s ease-in-out infinite" }} />
              <div>
                <p className="text-[14px] font-semibold text-[var(--text)]">Issue #1 — auth 401 blocking student submissions</p>
                <p className={`${mono.className} mt-1 text-[9px] text-[#3a3850]`}>prof-chen opened now · repository: AUBI-Demo</p>
              </div>
            </div>
            <Link href="/demo" className={`${mono.className} hidden rounded border border-[#7c6aff30] bg-[#7c6aff14] px-3 py-2 text-[9px] text-[#a594ff] md:inline-flex`}>
              Trigger AUBI →
            </Link>
          </div>
          <div className="flex items-center justify-between gap-4 px-8 py-10">
            {pipelineNodes.map((node, index) => (
              <div key={node.label} className="flex flex-1 items-center">
                <div className="relative flex min-w-[96px] flex-col items-center text-center">
                  <div
                    className="relative flex h-12 w-12 items-center justify-center rounded-lg border"
                    style={{
                      borderColor: node.state === "done" ? "#00e5a040" : node.state === "active" ? "#7c6aff40" : "#ffffff12",
                      background: node.state === "done" ? "#00e5a010" : node.state === "active" ? "#7c6aff12" : "transparent",
                      color: node.state === "done" ? "var(--green)" : node.state === "active" ? "#a594ff" : "var(--mid)"
                    }}
                  >
                    {node.icon}
                    {node.state === "done" && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--green)] text-[10px] text-[var(--bg)]">✓</span>}
                  </div>
                  <p className={`${mono.className} mt-3 text-[9px] uppercase text-[var(--mid)]`}>{node.label}</p>
                </div>
                {index < pipelineNodes.length - 1 && (
                  <div className="lp-connector relative mx-4 h-px flex-1 overflow-hidden bg-[var(--border)]" />
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 px-10 py-16 md:grid-cols-4">
          {[
            ["0", "Slack messages needed to route an issue"],
            ["6", "LangGraph nodes fully streamed over SSE"],
            ["∞", "Memory facts per developer in Qdrant"],
            ["90s", "From GitHub issue open to merged PR"]
          ].map(([number, description], index) => (
            <div key={number} className={`${index > 0 ? "border-l border-[#0f0f18]" : ""} px-8 py-4`}>
              <div className={syne.className} style={{ fontWeight: 800, fontSize: 52, background: "linear-gradient(135deg, #7c6aff, #00e5a0)", WebkitBackgroundClip: "text", color: "transparent" }}>{number}</div>
              <p className="mt-2 text-[13px] font-light text-[var(--muted)]">{description}</p>
            </div>
          ))}
        </section>

        <section id="how-it-works" className="px-10 py-20">
          <p className={`${mono.className} text-[8px] uppercase tracking-[4px] text-[var(--purple)]`}>How it works</p>
          <h2 className={`${syne.className} mt-4 text-[42px] font-extrabold leading-none text-[var(--text)]`}>From issue to pull request.</h2>
          <div className="mt-10">
            {steps.map((step) => (
              <div key={step.number} className="grid grid-cols-[120px_1px_1fr] border-t border-[#0f0f18] py-8">
                <div className={`${syne.className} text-[72px] font-extrabold leading-none text-[#111118]`}>{step.number}</div>
                <div className="bg-[#111118]" />
                <div className="pl-8">
                  <h3 className="text-[14px] font-medium text-[var(--text)]">{step.title}</h3>
                  <p className="mt-2 max-w-[620px] text-[12px] font-light leading-[1.85] text-[var(--muted)]">{step.description}</p>
                  <p className={`${mono.className} mt-3 text-[9px] uppercase tracking-[2px] ${step.hot ? "text-[var(--purple)]" : "text-[#3a3850]"}`}>{step.tag}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="px-10 py-20">
          <p className={`${mono.className} text-[8px] uppercase tracking-[4px] text-[var(--purple)]`}>Context Constitution</p>
          <h2 className={`${syne.className} mt-4 text-[42px] font-extrabold leading-none text-[var(--text)]`}>Agents with real memory.</h2>
          <div className="mt-10">
            {agents.map((agent, index) => (
              <div key={agent.name} className={`${index > 0 ? "border-t border-[#0f0f18]" : ""} grid grid-cols-[280px_1px_1fr] py-8`}>
                <div className="flex flex-col items-start gap-4 pr-8">
                  <HexNode />
                  <div>
                    <h3 className={`${syne.className} text-[18px] font-bold tracking-[3px] text-[var(--text)]`}>{agent.name}</h3>
                    <p className={`${mono.className} mt-1 text-[8px] uppercase tracking-[2px] text-[#3a3850]`}>{agent.role}</p>
                  </div>
                </div>
                <div className="bg-[#0f0f18]" />
                <div className="pl-8">
                  <table className="w-full border-collapse">
                    <tbody>
                      {agent.facts.map(([key, value]) => (
                        <tr key={`${agent.name}-${key}-${value}`} className="border-b border-[#0f0f18]">
                          <td className={`${mono.className} w-[160px] py-3 text-[9px] uppercase text-[#2e2c45]`}>{key}</td>
                          <td className="py-3 text-[12px] font-normal text-[var(--mid)]">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-6 space-y-4">
                    {agent.meters.map((meter, meterIndex) => (
                      <div key={meter}>
                        <div className="mb-2 flex justify-between">
                          <span className={`${mono.className} text-[9px] uppercase text-[#2e2c45]`}>{meter}</span>
                        </div>
                        <div className="h-px bg-[#0f0f18]">
                          <div className="h-[2px] bg-[var(--purple)]" style={{ width: meterIndex === 0 ? (agent.name.startsWith("Alice") ? "95%" : "88%") : (agent.name.startsWith("Alice") ? "92%" : "84%") }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="team" className="px-10 py-20">
          <p className={`${mono.className} text-[8px] uppercase tracking-[4px] text-[var(--purple)]`}>Team</p>
          <h2 className={`${syne.className} mt-4 text-[42px] font-extrabold leading-none text-[var(--text)]`}>The team.</h2>
          <div className="mt-10 grid grid-cols-1 border-y border-[#0f0f18] md:grid-cols-4">
            {team.map((member, index) => (
              <div key={member.name} className={`${index > 0 ? "md:border-l md:border-[#0f0f18]" : ""} px-8 py-7`}>
                <div className={`${syne.className} text-[52px] font-extrabold leading-none text-[#111118]`}>{member.initial}</div>
                <h3 className="mt-4 text-[14px] font-medium text-[var(--text)]">{member.name}</h3>
                <p className={`${mono.className} mt-2 text-[8px] uppercase tracking-[2px] text-[var(--purple)]`}>{member.domain}</p>
                <p className="mt-4 text-[11px] font-light leading-[1.85] text-[var(--muted)]">{member.description}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="grid grid-cols-1 items-center gap-4 border-t border-[var(--border)] px-10 py-7 md:grid-cols-3">
          <div className={`${syne.className} text-[16px] font-extrabold text-[#2e2c45]`}>AUBI</div>
          <div className={`${mono.className} text-center text-[9px] text-[#2e2c45]`}>GDSC Hackathon 2026 · University of Maryland</div>
          <div className="flex justify-start gap-2 md:justify-end">
            {["Dev Tool", "Most Creative", "Best Gemini"].map((badge) => (
              <span key={badge} className={`${mono.className} rounded border border-[#111118] px-2 py-1 text-[8px] text-[#2e2c45]`}>
                {badge}
              </span>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
