"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav() {
  const path = usePathname();

  return (
    <nav className="sticky top-0 z-50 h-[52px] flex items-center justify-between px-6 border-b border-[#1e2d45] bg-[#0a0e1acc] backdrop-blur-sm">
      {/* Wordmark */}
      <div className="flex flex-col leading-none">
        <span className="font-syne text-lg font-bold tracking-tight">
          <span className="text-[#00f0ff]">A</span>
          <span className="text-white">UBI</span>
        </span>
        <span className="font-mono text-[8px] text-[#4a6080] tracking-[0.18em] mt-0.5">
          AUTONOMOUS · AGENT · MESH
        </span>
      </div>

      {/* Nav links */}
      <div className="flex gap-8">
        {[
          { href: "/agents", label: "AGENTS" },
          { href: "/incident", label: "INCIDENT" },
        ].map(({ href, label }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={[
                "font-mono text-xs tracking-widest transition-colors",
                active
                  ? "text-[#00f0ff] border-b border-[#00f0ff] pb-px"
                  : "text-[#4a6080] hover:text-[#8aa0c0]",
              ].join(" ")}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
        <span className="font-mono text-[9px] text-[#10b981] tracking-widest">
          SYSTEM ONLINE
        </span>
      </div>
    </nav>
  );
}
