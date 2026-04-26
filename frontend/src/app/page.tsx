import Link from "next/link";
import type { CSSProperties } from "react";

const steps = [
  {
    number: "01",
    title: "Issue detected",
    description: "A GitHub issue opens with a failing path, trace, and enough noise to slow a team down.",
    tag: "issue_reader"
  },
  {
    number: "02",
    title: "Owner found",
    description: "AUBI routes through ownership memory instead of guessing in Slack.",
    tag: "ownership_router"
  },
  {
    number: "03",
    title: "Agents consulted",
    description: "The assigned developer agent returns code ownership, known failure modes, and communication context.",
    tag: "query_agents",
    hot: true
  },
  {
    number: "04",
    title: "Fix generated",
    description: "The backend graph reads source context, writes the patch, and prepares the PR narrative.",
    tag: "fix_generator"
  },
  {
    number: "05",
    title: "PR pushed",
    description: "AUBI opens a pull request with reviewers, issue linkage, and the owner voice preserved.",
    tag: "pr_pusher"
  }
];

const team = [
  {
    initial: "V",
    name: "Vitthal",
    domain: "Orchestration / Memory",
    description: "LangGraph graph, Claude prompts, Qdrant constitution store."
  },
  {
    initial: "N",
    name: "Neil",
    domain: "GitHub / Integrations",
    description: "Issue reader, code reader, PR pusher."
  },
  {
    initial: "A",
    name: "Avhaang",
    domain: "Frontend",
    description: "Agent cards, constitution viewer, communication feed."
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
    meters: [
      ["ownership", "95%"],
      ["confidence", "92%"]
    ]
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
    meters: [
      ["ownership", "88%"],
      ["confidence", "84%"]
    ]
  }
];

const pipelineNodes = [
  { label: "Issue Reader", state: "done", icon: <IssueIcon /> },
  { label: "Ownership Router", state: "done", icon: <RouteIcon /> },
  { label: "Query Agents", state: "active", icon: <AgentsIcon /> },
  { label: "Fix Generator", state: "idle", icon: <FixIcon /> },
  { label: "PR Pusher", state: "idle", icon: <PrIcon /> }
];

function IssueIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1" />
      <path d="M12 7v6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 18C6 8 18 16 18 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <circle cx="6" cy="18" r="2" stroke="currentColor" strokeWidth="1" />
      <circle cx="18" cy="6" r="2" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function AgentsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="9" r="3" stroke="currentColor" strokeWidth="1" />
      <circle cx="16" cy="9" r="3" stroke="currentColor" strokeWidth="1" />
      <path d="M4 19c.8-3 2.2-4 4-4s3.2 1 4 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M12 19c.8-3 2.2-4 4-4s3.2 1 4 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function FixIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m14 7 3 3-7 7H7v-3l7-7Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9 9 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function PrIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="18" r="2" stroke="currentColor" strokeWidth="1" />
      <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1" />
      <circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1" />
      <path d="M6 8v8" stroke="currentColor" strokeWidth="1" />
      <path d="M8 6h4a6 6 0 0 1 6 6v4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function HexNode() {
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" fill="none" aria-hidden="true">
      <path d="M56 8 98 32v48l-42 24-42-24V32L56 8Z" stroke="#e8e4dc" strokeOpacity=".22" strokeWidth="1" />
      <path d="M56 20 86 38v36L56 92 26 74V38l30-18Z" stroke="#e8e4dc" strokeOpacity=".5" strokeWidth="1" />
      <circle cx="56" cy="56" r="16" fill="#080808" stroke="#39ff14" strokeWidth="1" />
      <circle cx="56" cy="56" r="4" fill="#39ff14" />
    </svg>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <p className="font-mono text-[8px] uppercase tracking-[4px] text-[#39ff14]">{eyebrow}</p>
      <h2 className="font-syne mt-4 text-[42px] font-normal leading-[1.12] text-[#e8e4dc] md:text-[52px]">
        {title}
      </h2>
    </>
  );
}

function HeroMeshBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[720px] overflow-hidden">
      <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(#e8e4dc_1px,transparent_1px),linear-gradient(90deg,#e8e4dc_1px,transparent_1px)] [background-size:64px_64px]" />
      <div className="mesh-scan absolute inset-x-0 top-0 h-px bg-[#39ff14]" />
      <svg className="absolute left-1/2 top-6 h-[620px] w-[min(1120px,120vw)] -translate-x-1/2" viewBox="0 0 1120 620" fill="none">
        <path className="mesh-path mesh-path-a" d="M130 388 C260 230 354 472 500 292 C642 118 774 390 986 196" />
        <path className="mesh-path mesh-path-b" d="M162 190 C320 320 416 150 578 322 C704 456 828 270 1006 420" />
        <path className="mesh-path mesh-path-c" d="M244 482 C430 400 438 206 612 214 C760 220 806 112 976 120" />
        {[
          [130, 388],
          [244, 482],
          [360, 268],
          [500, 292],
          [578, 322],
          [612, 214],
          [758, 392],
          [882, 166],
          [986, 196],
          [1006, 420],
        ].map(([cx, cy], index) => (
          <g key={`${cx}-${cy}`} className="mesh-node" style={{ animationDelay: `${index * 0.18}s` }}>
            <path d={`M${cx} ${cy - 18} L${cx + 16} ${cy - 9} L${cx + 16} ${cy + 9} L${cx} ${cy + 18} L${cx - 16} ${cy + 9} L${cx - 16} ${cy - 9} Z`} />
            <circle cx={cx} cy={cy} r="3" />
          </g>
        ))}
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_38%,#080808_82%)]" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-[#080808]" />
    </div>
  );
}

export default function Home() {
  return (
    <div
      className="relative overflow-hidden"
      style={
        {
          "--bg": "#080808",
          "--text": "#e8e4dc",
          "--accent": "#39ff14",
          "--divider": "#1f1f1f",
          background: "var(--bg)",
          color: "var(--text)",
          minHeight: "calc(100vh - 52px)"
        } as CSSProperties
      }
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes breathe {
          0%, 100% { opacity: .45; }
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
        @keyframes meshScan {
          0% { transform: translateY(0); opacity: 0; }
          15% { opacity: .75; }
          100% { transform: translateY(640px); opacity: 0; }
        }
        @keyframes pathFlow {
          to { stroke-dashoffset: -220; }
        }
        @keyframes nodePulse {
          0%, 100% { opacity: .28; transform: scale(1); }
          50% { opacity: .95; transform: scale(1.08); }
        }
        @keyframes signalRise {
          0% { transform: translateY(10px); opacity: 0; }
          18%, 72% { opacity: 1; }
          100% { transform: translateY(-12px); opacity: 0; }
        }
        @keyframes borderSweep {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(220%); }
        }
        @keyframes softFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes activeNode {
          0%, 100% { border-color: #39ff14; background: #39ff1412; }
          50% { border-color: #e8e4dc99; background: #39ff1420; }
        }
        .landing-fade {
          opacity: 0;
          animation: fadeup .7s ease forwards;
          will-change: opacity, transform;
        }
        .aubi-button {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          border: 1px solid #e8e4dc33;
          transition: transform .22s ease, border-color .22s ease, background .22s ease, color .22s ease;
        }
        .aubi-button::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          background: linear-gradient(90deg, transparent, #e8e4dc22, transparent);
          transform: translateX(-120%);
          transition: transform .42s ease;
        }
        .aubi-button:hover {
          transform: translateY(-2px);
          border-color: #39ff14;
        }
        .aubi-button:hover::after {
          transform: translateX(120%);
        }
        .aubi-button-primary {
          border-color: #39ff14;
          background: #39ff14;
          color: #080808;
        }
        .aubi-button-secondary {
          background: #080808cc;
          color: #e8e4dc;
        }
        .mission-card {
          background:
            linear-gradient(180deg, #e8e4dc0a, transparent 42%),
            linear-gradient(90deg, #39ff1408, transparent 36%, #e8e4dc06);
        }
        .mission-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(90deg, transparent, #39ff1428, transparent);
          height: 1px;
          animation: borderSweep 5s linear infinite;
        }
        .interactive-surface {
          transition: transform .24s ease, border-color .24s ease, background .24s ease;
        }
        .interactive-surface:hover {
          transform: translateY(-3px);
          border-color: #39ff1455;
          background: #0b0b0b;
        }
        .active-pipeline-node {
          animation: activeNode 2.8s ease-in-out infinite;
        }
        .metric-tile {
          transition: transform .24s ease, background .24s ease;
        }
        .metric-tile:hover {
          transform: translateY(-4px);
          background: #e8e4dc08;
        }
        .hero-chip {
          animation: softFloat 4s ease-in-out infinite;
        }
        .mesh-scan {
          animation: meshScan 6s ease-in-out infinite;
          box-shadow: 0 0 18px #39ff1455;
        }
        .mesh-path {
          stroke: #e8e4dc;
          stroke-opacity: .18;
          stroke-width: 1;
          stroke-dasharray: 12 22;
          animation: pathFlow 10s linear infinite;
        }
        .mesh-path-a { stroke: #39ff14; stroke-opacity: .22; animation-duration: 8s; }
        .mesh-path-b { animation-duration: 12s; }
        .mesh-path-c { stroke: #39ff14; stroke-opacity: .14; animation-duration: 14s; }
        .mesh-node {
          transform-box: fill-box;
          transform-origin: center;
          animation: nodePulse 3.8s ease-in-out infinite;
        }
        .mesh-node path {
          fill: #080808;
          stroke: #e8e4dc;
          stroke-opacity: .22;
          stroke-width: 1;
        }
        .mesh-node circle { fill: #39ff14; }
        .signal-rise {
          animation: signalRise 2.6s ease-in-out infinite;
        }
        .landing-connector::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          width: 55%;
          background: linear-gradient(90deg, transparent, #39ff14, transparent);
          animation: slide 2.4s linear infinite;
        }
      ` }} />

      <HeroMeshBackdrop />

      <section className="relative z-10 px-6 pb-24 pt-24 text-center md:px-10">
        <div className="hero-chip landing-fade mx-auto inline-flex items-center gap-3 border border-[#e8e4dc33] bg-[#080808aa] px-4 py-2" style={{ animationDelay: "0s" }}>
          <span className="h-[5px] w-[5px] rounded-full bg-[#39ff14]" style={{ animation: "breathe 2s ease-in-out infinite" }} />
          <span className="font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dccc]">Live at GDSC Hackathon / UMD / April 26</span>
        </div>

        <h1 className="font-syne landing-fade mx-auto mt-8 max-w-[820px] text-[56px] font-normal leading-[1.18] tracking-[4px] text-[#e8e4dc] md:text-[84px]" style={{ animationDelay: ".1s" }}>
          Your codebase already knows <span className="text-[#39ff14]">who to call.</span>
        </h1>

        <p className="font-mono landing-fade mx-auto mt-5 text-[10px] uppercase tracking-[4px] text-[#39ff14]" style={{ animationDelay: ".15s" }}>
          Autonomous Understanding &amp; Behaviour Inference
        </p>

        <p className="landing-fade mx-auto mt-6 max-w-[560px] text-[16px] leading-[1.85] text-[#e8e4dc99]" style={{ animationDelay: ".2s" }}>
          A GitHub issue drops. AUBI&apos;s agent mesh finds the right developer by memory, generates the fix, and pushes the PR. No Slack. No guessing. No human routing.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/demo" className="aubi-button aubi-button-primary px-6 py-3 text-[13px] font-medium">
            Launch Demo
          </Link>
          <Link href="/incident" className="aubi-button aubi-button-secondary px-6 py-3 text-[13px] font-medium">
            Open War Room
          </Link>
          <Link href="/agents" className="aubi-button aubi-button-secondary px-6 py-3 text-[13px] font-medium">
            View Agent Mesh
          </Link>
        </div>

        <div className="font-mono mt-6 flex flex-wrap items-center justify-center gap-3 text-[9px] uppercase tracking-[2px] text-[#e8e4dc66]">
          {["Best Developer Tool", "Most Creative", "Best Use of Gemini", "Claude Sonnet / LangGraph / Qdrant"].map((tag, index) => (
            <span key={tag} className="flex items-center gap-3">
              {index > 0 && <span className="h-[3px] w-[3px] rounded-full bg-[#e8e4dc66]" />}
              {tag}
            </span>
          ))}
        </div>
      </section>

      <section id="architecture" className="mission-card relative z-10 mx-6 mb-16 overflow-hidden border border-[#e8e4dc33] bg-[#080808dd] md:mx-10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#39ff14] to-transparent opacity-70" />
        <div className="font-mono flex items-center justify-between border-b border-[#1f1f1f] px-6 py-4 text-[10px] uppercase tracking-[3px] text-[#e8e4dc66]">
          <span>LangGraph Pipeline / Live Execution</span>
          <span className="signal-rise text-[#39ff14]">Running</span>
        </div>
        <div className="flex flex-col gap-4 border-b border-[#1f1f1f] px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <span className="h-2 w-2 rounded-full bg-[#39ff14]" style={{ animation: "breathe 2s ease-in-out infinite" }} />
            <div>
              <p className="text-[14px] font-medium text-[#e8e4dc]">Issue #1 - auth 401 blocking student submissions</p>
              <p className="font-mono mt-1 text-[9px] uppercase tracking-[2px] text-[#e8e4dc66]">prof-chen opened now / repository: AUBI-Demo</p>
            </div>
          </div>
          <Link href="/demo" className="aubi-button font-mono border-[#39ff14] px-3 py-2 text-[9px] uppercase tracking-[2px] text-[#39ff14]">
            Trigger AUBI
          </Link>
        </div>
        <div className="flex flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          {pipelineNodes.map((node, index) => (
            <div key={node.label} className="landing-fade flex flex-1 items-center" style={{ animationDelay: `${0.1 + index * 0.08}s` }}>
              <div className="relative flex min-w-[96px] flex-col items-center text-center">
                <div
                  className={[
                    "relative flex h-12 w-12 items-center justify-center border transition-transform duration-300 hover:-translate-y-1",
                    node.state === "active" ? "active-pipeline-node" : "",
                  ].join(" ")}
                  style={{
                    borderColor: node.state === "idle" ? "#1f1f1f" : "#39ff14",
                    background: node.state === "active" ? "#39ff1414" : "transparent",
                    color: node.state === "idle" ? "#e8e4dc66" : "#39ff14"
                  }}
                >
                  {node.icon}
                  {node.state === "done" && <span className="absolute -right-px -top-px flex h-4 w-4 items-center justify-center bg-[#39ff14] text-[10px] text-[#080808]">✓</span>}
                </div>
                <p className="font-mono mt-3 text-[9px] uppercase tracking-[2px] text-[#e8e4dc99]">{node.label}</p>
              </div>
              {index < pipelineNodes.length - 1 && (
                <div className="landing-connector relative mx-4 hidden h-px flex-1 overflow-hidden bg-[#1f1f1f] md:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 grid grid-cols-2 px-6 py-16 md:grid-cols-4 md:px-10">
        {[
          ["0", "Slack messages needed to route an issue"],
          ["6", "LangGraph nodes fully streamed over SSE"],
          ["INF", "Memory facts per developer in Qdrant"],
            ["90s", "From GitHub issue open to merged PR"]
          ].map(([number, description], index) => (
          <div key={number} className={`${index > 0 ? "md:border-l md:border-[#1f1f1f]" : ""} metric-tile landing-fade px-6 py-4`} style={{ animationDelay: `${index * 0.08}s` }}>
            <div className="font-syne text-[52px] font-normal leading-none tracking-[4px] text-[#e8e4dc] transition-colors duration-300 hover:text-[#39ff14]">{number}</div>
            <p className="mt-2 text-[13px] leading-[1.6] text-[#e8e4dc66]">{description}</p>
          </div>
        ))}
      </section>

      <section id="how-it-works" className="relative z-10 px-6 py-20 md:px-10">
        <SectionHeading eyebrow="How it works" title="From issue to pull request." />
        <div className="mt-10">
          {steps.map((step) => (
            <div key={step.number} className="interactive-surface grid grid-cols-[96px_1px_1fr] border-t border-[#1f1f1f] py-8 md:grid-cols-[120px_1px_1fr]">
              <div className="font-syne text-[64px] font-normal leading-none tracking-[4px] text-[#e8e4dc14] md:text-[72px]">{step.number}</div>
              <div className="bg-[#1f1f1f]" />
              <div className="pl-6 md:pl-8">
                <h3 className="text-[14px] font-medium text-[#e8e4dc]">{step.title}</h3>
                <p className="mt-2 max-w-[620px] text-[12px] leading-[1.85] text-[#e8e4dc66]">{step.description}</p>
                <p className={`font-mono mt-3 text-[9px] uppercase tracking-[2px] ${step.hot ? "text-[#39ff14]" : "text-[#e8e4dc66]"}`}>{step.tag}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 px-6 py-20 md:px-10">
        <SectionHeading eyebrow="Context Constitution" title="Agents with real memory." />
        <div className="mt-10">
          {agents.map((agent, index) => (
            <div key={agent.name} className={`${index > 0 ? "border-t border-[#1f1f1f]" : ""} interactive-surface grid gap-8 py-8 md:grid-cols-[280px_1px_1fr]`}>
              <div className="flex flex-col items-start gap-4 pr-8">
                <HexNode />
                <div>
                  <h3 className="font-syne text-[24px] font-normal tracking-[4px] text-[#e8e4dc]">{agent.name}</h3>
                  <p className="font-mono mt-1 text-[8px] uppercase tracking-[2px] text-[#e8e4dc66]">{agent.role}</p>
                </div>
              </div>
              <div className="hidden bg-[#1f1f1f] md:block" />
              <div className="md:pl-8">
                <table className="w-full border-collapse">
                  <tbody>
                    {agent.facts.map(([key, value]) => (
                      <tr key={`${agent.name}-${key}-${value}`} className="border-b border-[#1f1f1f]">
                        <td className="font-mono w-[140px] py-3 text-[9px] uppercase tracking-[2px] text-[#e8e4dc66] md:w-[160px]">{key}</td>
                        <td className="py-3 text-[12px] text-[#e8e4dc99]">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-6 space-y-4">
                  {agent.meters.map(([meter, value]) => (
                    <div key={meter}>
                      <div className="mb-2 flex justify-between">
                        <span className="font-mono text-[9px] uppercase tracking-[2px] text-[#e8e4dc66]">{meter}</span>
                        <span className="font-mono text-[9px] uppercase tracking-[2px] text-[#39ff14]">{value}</span>
                      </div>
                      <div className="h-px bg-[#1f1f1f]">
                        <div className="h-[2px] bg-[#39ff14]" style={{ width: value }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="team" className="relative z-10 px-6 py-20 md:px-10">
        <SectionHeading eyebrow="Team" title="The team." />
        <div className="mt-10 grid grid-cols-1 border-y border-[#1f1f1f] md:grid-cols-4">
          {team.map((member, index) => (
              <div key={member.name} className={`${index > 0 ? "md:border-l md:border-[#1f1f1f]" : ""} interactive-surface px-8 py-7`}>
              <div className="font-syne text-[52px] font-normal leading-none tracking-[4px] text-[#e8e4dc14]">{member.initial}</div>
              <h3 className="mt-4 text-[14px] font-medium text-[#e8e4dc]">{member.name}</h3>
              <p className="font-mono mt-2 text-[8px] uppercase tracking-[2px] text-[#39ff14]">{member.domain}</p>
              <p className="mt-4 text-[11px] leading-[1.85] text-[#e8e4dc66]">{member.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 grid grid-cols-1 items-center gap-4 border-t border-[#1f1f1f] px-6 py-7 md:grid-cols-3 md:px-10">
        <div className="font-syne text-[20px] font-normal tracking-[4px] text-[#e8e4dc66]">AUBI</div>
        <div className="font-mono text-center text-[9px] uppercase tracking-[2px] text-[#e8e4dc66]">GDSC Hackathon 2026 / University of Maryland</div>
        <div className="flex justify-start gap-2 md:justify-end">
          {["Dev Tool", "Most Creative", "Best Gemini"].map((badge) => (
            <span key={badge} className="font-mono border border-[#1f1f1f] px-2 py-1 text-[8px] uppercase tracking-[2px] text-[#e8e4dc66]">
              {badge}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
