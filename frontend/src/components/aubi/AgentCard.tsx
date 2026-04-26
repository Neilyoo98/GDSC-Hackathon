"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { Agent } from "@/lib/types";
import { collaborationBlurb, coworkerName, factObjects, humanSourceLabel, shortRole } from "@/lib/agents";
import { BorderBeam } from "@/components/ui/border-beam";

export function AgentCard({
  agent,
  index,
  selected,
  onSelect
}: {
  agent: Agent;
  index: number;
  selected?: boolean;
  onSelect: (agent: Agent) => void;
}) {
  const expertise  = factObjects(agent, "expertise", 4)
    .flatMap((item) => item.split(",").map((part) => part.trim()))
    .filter(Boolean)
    .slice(0, 4);
  const ownership  = factObjects(agent, "code_ownership", 3);
  const factCount  = agent.constitution_facts.length;
  const fillPct    = Math.min(100, Math.round((factCount / 10) * 100));

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(agent)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      whileHover={{ y: -3 }}
      className={[
        "group relative min-h-[280px] overflow-hidden border bg-[#080808] p-6 text-left transition-all duration-300",
        selected
          ? "border-[#39ff14] shadow-[0_0_24px_#39ff1420]"
          : "border-[#e8e4dc18] hover:border-[#e8e4dc40] hover:shadow-[0_0_16px_#e8e4dc08]"
      ].join(" ")}
    >
      {/* Scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #e8e4dc 2px, #e8e4dc 3px)",
          backgroundSize: "100% 3px",
        }}
      />

      {/* BorderBeam on hover / when selected */}
      {selected && (
        <BorderBeam size={180} duration={8} colorFrom="#39ff14" colorTo="#00f0ff" />
      )}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <BorderBeam size={160} duration={10} colorFrom="#39ff1480" colorTo="#00f0ff80" delay={3} />
      </div>

      {/* Status badge */}
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#39ff14]" />
        <span className="font-mono text-[8px] uppercase tracking-[3px] text-[#39ff14]">Online</span>
      </div>

      {/* Avatar + name */}
      <div className="flex items-start gap-4">
        <div className="relative flex-shrink-0">
          {/* Glow ring */}
          <div className={[
            "absolute -inset-1 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100",
            selected ? "opacity-100" : ""
          ].join(" ")}
            style={{ background: "radial-gradient(circle, #39ff1430 0%, transparent 70%)" }}
          />
          <div className={[
            "relative rounded-full p-0.5",
            selected ? "bg-gradient-to-br from-[#39ff14] to-[#00f0ff]" : "bg-[#e8e4dc18]"
          ].join(" ")}>
            <Image
              src={`https://github.com/${agent.github_username}.png?size=96`}
              alt={coworkerName(agent)}
              width={52}
              height={52}
              className="rounded-full"
            />
          </div>
        </div>

        <div className="min-w-0 pr-16">
          <h2 className="font-syne text-2xl font-normal leading-none text-[#e8e4dc] group-hover:text-white transition-colors">
            {coworkerName(agent)}
          </h2>
          <div className="mt-2 inline-flex border border-[#e8e4dc22] bg-[#e8e4dc08] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[2px] text-[#e8e4dc80]">
            {shortRole(agent.role)}
          </div>
          <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[2px] text-[#e8e4dc44]">{humanSourceLabel(agent)}</p>
        </div>
      </div>

      {/* Expertise tags */}
      <div className="mt-5">
        <div className="mb-2 font-mono text-[8px] uppercase tracking-[3px] text-[#e8e4dc55]">Expertise</div>
        <div className="flex flex-wrap gap-1.5">
          {(expertise.length ? expertise : agent.github_data_summary.languages).slice(0, 4).map((item) => (
            <span
              key={item}
              className="border border-[#39ff1430] bg-[#39ff1408] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[1px] text-[#39ff14cc] transition-colors group-hover:border-[#39ff1460] group-hover:bg-[#39ff1412]"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Ownership */}
      <div className="mt-3">
        <div className="mb-2 font-mono text-[8px] uppercase tracking-[3px] text-[#e8e4dc55]">Code Ownership</div>
        <div className="flex flex-wrap gap-1.5">
          {(ownership.length ? ownership : agent.github_data_summary.top_files).slice(0, 3).map((item) => (
            <span
              key={item}
              className="border border-[#00f0ff20] bg-[#00f0ff06] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[1px] text-[#00f0ff99] transition-colors group-hover:border-[#00f0ff40]"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Collab blurb */}
      <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-[#e8e4dc66]">
        {collaborationBlurb(agent)}
      </p>

      {/* Footer: constitution progress bar */}
      <div className="mt-5 border-t border-[#1f1f1f] pt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-[8px] uppercase tracking-[2px] text-[#e8e4dc44]">Constitution</span>
          <span className="font-mono text-[9px] text-[#e8e4dc80]">{factCount} facts · {fillPct}%</span>
        </div>
        <div className="h-px w-full bg-[#1f1f1f] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${fillPct}%` }}
            transition={{ delay: index * 0.08 + 0.3, duration: 0.8, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-[#39ff14] to-[#00f0ff]"
          />
        </div>
      </div>
    </motion.button>
  );
}
