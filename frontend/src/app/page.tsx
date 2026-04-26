import Link from "next/link";
import type { CSSProperties } from "react";

// Real team members — AI coworkers built from their actual GitHub activity
const coworkers = [
  {
    github: "Vitthal-Agarwal",
    name: "Vitthal",
    role: "Backend · Go, Python, Docker",
    owns: ["auth/ directory", "auth/token.go", "backend/"],
    known: "Race condition in auth/token.go GetOrRefresh — no mutex on cache map",
  },
  {
    github: "avhaan",
    name: "Avhaang",
    role: "Frontend · JavaScript, TypeScript, CSS",
    owns: ["frontend/ directory", "UI components"],
    known: "Layout issues in hero tagline and insight sparklines",
  },
  {
    github: "Mitanshcodes",
    name: "Mitansh",
    role: "Full-stack · JavaScript, Python, C++",
    owns: ["Day_2/ directory", "collaborative features"],
    known: "Active across frontend and backend integrations",
  },
  {
    github: "Neilyoo98",
    name: "Neil",
    role: "Integrations · Go, Python, JavaScript",
    owns: ["GitHub integrations", "issue reader", "PR pusher"],
    known: "Working on BigThinkWorld and hackathon tooling",
  },
];

const useCaseSteps = [
  {
    number: "01",
    title: "Issue opens",
    description: "A GitHub issue drops. Something is broken in auth. Users are getting 401s.",
    tag: "issue_reader",
  },
  {
    number: "02",
    title: "Right coworker found",
    description: "AUBI checks who owns auth/ from commit history and constitution memory — no Slack needed.",
    tag: "ownership_router",
  },
  {
    number: "03",
    title: "Coworkers consult each other",
    description: "The mesh exchanges context. Vitthal's coworker already knows about the race condition. Bob's coworker flags the adjacent PR.",
    tag: "coworker_mesh",
    hot: true,
  },
  {
    number: "04",
    title: "Fix generated",
    description: "AUBI reads the actual code, writes the patch using shared team context, and runs the tests.",
    tag: "fix_generator",
  },
  {
    number: "05",
    title: "PR pushed",
    description: "You approve. AUBI opens the PR on GitHub with full context — owner, fix, test results.",
    tag: "pr_pusher",
  },
];

const constitutionSignals = [
  {
    label: "ownership",
    description: "Which files and directories each developer owns, inferred from real commit history.",
  },
  {
    label: "expertise",
    description: "Languages, frameworks, and domains each person actually works in — not self-reported.",
  },
  {
    label: "collaboration style",
    description: "How they prefer to communicate. Used when drafting fixes and PR messages in their voice.",
  },
  {
    label: "incident memory",
    description: "After every resolved incident, the coworker learns. Future runs reuse that context.",
  },
];

const pipelineNodes = [
  { label: "Issue Reader", state: "done", icon: <IssueIcon /> },
  { label: "Ownership Router", state: "done", icon: <RouteIcon /> },
  { label: "Coworker Mesh", state: "active", icon: <AgentsIcon /> },
  { label: "Fix Generator", state: "idle", icon: <FixIcon /> },
  { label: "PR Pusher", state: "idle", icon: <PrIcon /> },
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
          [130, 388],[244, 482],[360, 268],[500, 292],[578, 322],
          [612, 214],[758, 392],[882, 166],[986, 196],[1006, 420],
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
          minHeight: "calc(100vh - 52px)",
        } as CSSProperties
      }
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes breathe { 0%,100%{opacity:.45}50%{opacity:1} }
        @keyframes slide { from{left:-100%}to{left:200%} }
        @keyframes fadeup { from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)} }
        @keyframes meshScan { 0%{transform:translateY(0);opacity:0}15%{opacity:.75}100%{transform:translateY(640px);opacity:0} }
        @keyframes pathFlow { to{stroke-dashoffset:-220} }
        @keyframes nodePulse { 0%,100%{opacity:.28;transform:scale(1)}50%{opacity:.95;transform:scale(1.08)} }
        @keyframes signalRise { 0%{transform:translateY(10px);opacity:0}18%,72%{opacity:1}100%{transform:translateY(-12px);opacity:0} }
        @keyframes borderSweep { 0%{transform:translateX(-120%)}100%{transform:translateX(220%)} }
        @keyframes softFloat { 0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)} }
        @keyframes activeNode { 0%,100%{border-color:#39ff14;background:#39ff1412}50%{border-color:#e8e4dc99;background:#39ff1420} }
        .landing-fade{opacity:0;animation:fadeup .7s ease forwards;will-change:opacity,transform}
        .aubi-button{position:relative;isolation:isolate;overflow:hidden;border:1px solid #e8e4dc33;transition:transform .22s ease,border-color .22s ease,background .22s ease,color .22s ease}
        .aubi-button::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,transparent,#e8e4dc22,transparent);transform:translateX(-120%);transition:transform .42s ease}
        .aubi-button:hover{transform:translateY(-2px);border-color:#39ff14}
        .aubi-button:hover::after{transform:translateX(120%)}
        .aubi-button-primary{border-color:#39ff14;background:#39ff14;color:#080808}
        .aubi-button-secondary{background:#080808cc;color:#e8e4dc}
        .interactive-surface{transition:transform .24s ease,border-color .24s ease,background .24s ease}
        .interactive-surface:hover{transform:translateY(-3px);border-color:#39ff1455;background:#0b0b0b}
        .active-pipeline-node{animation:activeNode 2.8s ease-in-out infinite}
        .metric-tile{transition:transform .24s ease,background .24s ease}
        .metric-tile:hover{transform:translateY(-4px);background:#e8e4dc08}
        .hero-chip{animation:softFloat 4s ease-in-out infinite}
        .mesh-scan{animation:meshScan 6s ease-in-out infinite;box-shadow:0 0 18px #39ff1455}
        .mesh-path{stroke:#e8e4dc;stroke-opacity:.18;stroke-width:1;stroke-dasharray:12 22;animation:pathFlow 10s linear infinite}
        .mesh-path-a{stroke:#39ff14;stroke-opacity:.22;animation-duration:8s}
        .mesh-path-b{animation-duration:12s}
        .mesh-path-c{stroke:#39ff14;stroke-opacity:.14;animation-duration:14s}
        .mesh-node{transform-box:fill-box;transform-origin:center;animation:nodePulse 3.8s ease-in-out infinite}
        .mesh-node path{fill:#080808;stroke:#e8e4dc;stroke-opacity:.22;stroke-width:1}
        .mesh-node circle{fill:#39ff14}
        .signal-rise{animation:signalRise 2.6s ease-in-out infinite}
        .landing-connector::after{content:"";position:absolute;top:0;bottom:0;width:55%;background:linear-gradient(90deg,transparent,#39ff14,transparent);animation:slide 2.4s linear infinite}
        .coworker-card{transition:transform .24s ease,border-color .24s ease}
        .coworker-card:hover{transform:translateY(-4px);border-color:#39ff1444}
      ` }} />

      <HeroMeshBackdrop />

      {/* ── HERO ── */}
      <section className="relative z-10 px-6 pb-24 pt-24 text-center md:px-10">
        <div className="hero-chip landing-fade mx-auto inline-flex items-center gap-3 border border-[#e8e4dc33] bg-[#080808aa] px-4 py-2" style={{ animationDelay: "0s" }}>
          <span className="h-[5px] w-[5px] rounded-full bg-[#39ff14]" style={{ animation: "breathe 2s ease-in-out infinite" }} />
          <span className="font-mono text-[10px] uppercase tracking-[3px] text-[#e8e4dccc]">Live at GDSC Hackathon · UMD · April 26</span>
        </div>

        <h1 className="font-syne landing-fade mx-auto mt-8 max-w-[860px] text-[56px] font-normal leading-[1.18] tracking-[4px] text-[#e8e4dc] md:text-[84px]" style={{ animationDelay: ".1s" }}>
          Every developer gets an AI coworker that <span className="text-[#39ff14]">actually knows them.</span>
        </h1>

        <p className="font-mono landing-fade mx-auto mt-5 text-[10px] uppercase tracking-[4px] text-[#39ff14]" style={{ animationDelay: ".15s" }}>
          Autonomous Understanding &amp; Behaviour Inference
        </p>

        <p className="landing-fade mx-auto mt-6 max-w-[580px] text-[16px] leading-[1.85] text-[#e8e4dc99]" style={{ animationDelay: ".2s" }}>
          AUBI reads your team&apos;s GitHub history and builds a persistent AI coworker for each developer. These coworkers know who owns what, share context with each other, and step in when something breaks — without anyone having to ask.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/incident" className="aubi-button aubi-button-primary px-6 py-3 text-[13px] font-medium">
            See it fix a bug
          </Link>
          <Link href="/team" className="aubi-button aubi-button-secondary px-6 py-3 text-[13px] font-medium">
            Meet the coworkers
          </Link>
          <Link href="/demo" className="aubi-button aubi-button-secondary px-6 py-3 text-[13px] font-medium">
            Watch the mesh
          </Link>
        </div>

        <div className="font-mono mt-6 flex flex-wrap items-center justify-center gap-3 text-[9px] uppercase tracking-[2px] text-[#e8e4dc66]">
          {["Best Developer Tool", "Most Creative", "Claude Sonnet · LangGraph · Qdrant"].map((tag, i) => (
            <span key={tag} className="flex items-center gap-3">
              {i > 0 && <span className="h-[3px] w-[3px] rounded-full bg-[#e8e4dc66]" />}
              {tag}
            </span>
          ))}
        </div>
      </section>

      {/* ── COWORKER MESH ── */}
      <section className="relative z-10 px-6 py-20 md:px-10">
        <SectionHeading eyebrow="The coworker mesh" title="Your team — as a living memory." />
        <p className="mt-4 max-w-[560px] text-[14px] leading-[1.85] text-[#e8e4dc66]">
          Each developer&apos;s GitHub history is turned into a Context Constitution — a structured memory of what they own, what they know, and how they work. These constitutions power the mesh.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {coworkers.map((cw, index) => (
            <div
              key={cw.github}
              className="coworker-card landing-fade border border-[#1f1f1f] bg-[#080808] p-5"
              style={{ animationDelay: `${0.05 + index * 0.08}s` }}
            >
              <div className="flex items-center gap-3 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://github.com/${cw.github}.png?size=64`}
                  alt={cw.name}
                  width={36}
                  height={36}
                  className="border border-[#e8e4dc22]"
                />
                <div>
                  <p className="text-[14px] font-medium text-[#e8e4dc]">{cw.name}</p>
                  <p className="font-mono text-[9px] uppercase tracking-[2px] text-[#e8e4dc55]">{cw.role.split("·")[0].trim()}</p>
                </div>
              </div>
              <div className="space-y-2">
                {cw.owns.slice(0, 2).map((o) => (
                  <div key={o} className="flex items-start gap-2">
                    <span className="font-mono mt-0.5 text-[8px] uppercase tracking-[2px] text-[#39ff1466]">owns</span>
                    <span className="text-[11px] text-[#e8e4dc88]">{o}</span>
                  </div>
                ))}
                <div className="flex items-start gap-2 pt-1 border-t border-[#1f1f1f]">
                  <span className="font-mono mt-0.5 text-[8px] uppercase tracking-[2px] text-[#e8e4dc33]">knows</span>
                  <span className="text-[10px] leading-relaxed text-[#e8e4dc55]">{cw.known}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-start">
          <Link href="/team" className="aubi-button aubi-button-secondary font-mono px-4 py-2 text-[10px] uppercase tracking-[2px]">
            Inspect full constitutions →
          </Link>
        </div>
      </section>

      {/* ── USE CASE PIPELINE ── */}
      <section className="relative z-10 mx-6 mb-16 overflow-hidden border border-[#e8e4dc33] bg-[#080808dd] md:mx-10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#39ff14] to-transparent opacity-70" />
        <div className="font-mono flex items-center justify-between border-b border-[#1f1f1f] px-6 py-4 text-[10px] uppercase tracking-[3px] text-[#e8e4dc66]">
          <span>Use case · Live incident</span>
          <span className="signal-rise text-[#39ff14]">Running</span>
        </div>
        <div className="flex flex-col gap-4 border-b border-[#1f1f1f] px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <span className="h-2 w-2 rounded-full bg-[#39ff14]" style={{ animation: "breathe 2s ease-in-out infinite" }} />
            <div>
              <p className="text-[14px] font-medium text-[#e8e4dc]">Issue #1 — auth 401s blocking users after latest deploy</p>
              <p className="font-mono mt-1 text-[9px] uppercase tracking-[2px] text-[#e8e4dc66]">repo: Neilyoo98/AUBI-demo · AUBI routing to Vitthal</p>
            </div>
          </div>
          <Link href="/incident" className="aubi-button font-mono border-[#39ff14] px-3 py-2 text-[9px] uppercase tracking-[2px] text-[#39ff14]">
            Open war room
          </Link>
        </div>
        <div className="flex flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          {pipelineNodes.map((node, index) => (
            <div key={node.label} className="landing-fade flex flex-1 items-center" style={{ animationDelay: `${0.1 + index * 0.08}s` }}>
              <div className="relative flex min-w-[96px] flex-col items-center text-center">
                <div
                  className={["relative flex h-12 w-12 items-center justify-center border transition-transform duration-300 hover:-translate-y-1", node.state === "active" ? "active-pipeline-node" : ""].join(" ")}
                  style={{ borderColor: node.state === "idle" ? "#1f1f1f" : "#39ff14", background: node.state === "active" ? "#39ff1414" : "transparent", color: node.state === "idle" ? "#e8e4dc66" : "#39ff14" }}
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

      {/* ── STATS ── */}
      <section className="relative z-10 grid grid-cols-2 px-6 py-16 md:grid-cols-4 md:px-10">
        {[
          ["4", "real developers with AI coworkers"],
          ["0", "Slack messages needed to route an issue"],
          ["∞", "memory facts per developer in Qdrant"],
          ["90s", "from GitHub issue open to merged PR"],
        ].map(([number, description], index) => (
          <div key={number} className={`${index > 0 ? "md:border-l md:border-[#1f1f1f]" : ""} metric-tile landing-fade px-6 py-4`} style={{ animationDelay: `${index * 0.08}s` }}>
            <div className="font-syne text-[52px] font-normal leading-none tracking-[4px] text-[#e8e4dc] transition-colors duration-300 hover:text-[#39ff14]">{number}</div>
            <p className="mt-2 text-[13px] leading-[1.6] text-[#e8e4dc66]">{description}</p>
          </div>
        ))}
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="relative z-10 px-6 py-20 md:px-10">
        <SectionHeading eyebrow="How it works" title="Coworkers consult. Bug gets fixed." />
        <div className="mt-10">
          {useCaseSteps.map((step) => (
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

      {/* ── CONTEXT CONSTITUTION ── */}
      <section className="relative z-10 px-6 py-20 md:px-10">
        <SectionHeading eyebrow="Context Constitution" title="What each coworker remembers." />
        <p className="mt-4 max-w-[560px] text-[14px] leading-[1.85] text-[#e8e4dc66]">
          Built from real GitHub activity. Updated after every incident. No fake data, no self-reported profiles.
        </p>
        <div className="mt-10 grid gap-px border border-[#1f1f1f] md:grid-cols-2 lg:grid-cols-4">
          {constitutionSignals.map((signal, index) => (
            <div key={signal.label} className="interactive-surface landing-fade border-[#1f1f1f] bg-[#080808] p-6 md:border-l" style={{ animationDelay: `${index * 0.07}s` }}>
              <p className="font-mono text-[9px] uppercase tracking-[3px] text-[#39ff14]">{signal.label}</p>
              <p className="mt-3 text-[12px] leading-[1.85] text-[#e8e4dc66]">{signal.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 grid grid-cols-1 items-center gap-4 border-t border-[#1f1f1f] px-6 py-7 md:grid-cols-3 md:px-10">
        <div className="font-syne text-[20px] font-normal tracking-[4px] text-[#e8e4dc66]">AUBI</div>
        <div className="font-mono text-center text-[9px] uppercase tracking-[2px] text-[#e8e4dc66]">GDSC Hackathon 2026 · University of Maryland</div>
        <div className="flex justify-start gap-2 md:justify-end">
          {["Dev Tool", "Most Creative"].map((badge) => (
            <span key={badge} className="font-mono border border-[#1f1f1f] px-2 py-1 text-[8px] uppercase tracking-[2px] text-[#e8e4dc66]">
              {badge}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
