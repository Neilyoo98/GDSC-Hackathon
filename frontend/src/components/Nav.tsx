"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav() {
  const path = usePathname();

  return (
    <nav className="sticky top-0 z-50 flex h-[52px] items-center justify-between border-b border-[#1f1f1f] bg-[#080808] px-6">
      <Link
        href="/"
        aria-label="AUBI home"
        className="flex flex-col leading-none transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39ff14]"
      >
        <span className="font-syne text-2xl font-normal tracking-[4px] text-[#e8e4dc]">AUBI</span>
        <span className="mt-1 font-mono text-[8px] uppercase tracking-[2px] text-[#e8e4dc99]">
          Autonomous Understanding and Behaviour Inference
        </span>
      </Link>

      <div className="flex gap-8">
        {[
          { href: "/team", label: "TEAM" },
          { href: "/demo", label: "FLOW" },
          { href: "/agents", label: "AGENTS" },
          { href: "/incident", label: "INCIDENT" }
        ].map(({ href, label }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={[
                "border-b font-mono text-xs uppercase tracking-[3px] transition-colors",
                active
                  ? "border-[#39ff14] text-[#39ff14]"
                  : "border-transparent text-[#e8e4dc99] hover:text-[#e8e4dc]"
              ].join(" ")}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#39ff14]" />
        <span className="font-mono text-[9px] uppercase tracking-[3px] text-[#39ff14]">
          System Online
        </span>
      </div>
    </nav>
  );
}
