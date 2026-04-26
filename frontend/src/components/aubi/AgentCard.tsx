"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { Agent } from "@/lib/types";
import { collaborationBlurb, factObjects, shortRole } from "@/lib/agents";

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
  const expertise = factObjects(agent, "expertise", 4)
    .flatMap((item) => item.split(",").map((part) => part.trim()))
    .filter(Boolean)
    .slice(0, 4);
  const ownership = factObjects(agent, "code_ownership", 3);

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(agent)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.32 }}
      className={[
        "group relative min-h-[264px] border bg-[#080808] p-6 text-left transition-colors",
        selected
          ? "border-[#39ff14] text-[#e8e4dc]"
          : "border-[#e8e4dc33] hover:border-[#e8e4dc80]"
      ].join(" ")}
    >
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#39ff14]" />
        <span className="font-mono text-[9px] uppercase tracking-[3px] text-[#39ff14]">Online</span>
      </div>

      <div className="flex items-start gap-4">
        <Image
          src={`https://github.com/${agent.github_username}.png?size=96`}
          alt={agent.name}
          width={56}
          height={56}
          className="border border-[#e8e4dc33] bg-[#080808]"
        />
        <div className="min-w-0 pr-20">
          <h2 className="font-syne text-3xl font-normal leading-none text-[#e8e4dc]">{agent.name}</h2>
          <div className="mt-2 inline-flex border border-[#e8e4dc33] px-2 py-1 font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc99]">
            {shortRole(agent.role)}
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc66]">@{agent.github_username}</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 font-mono text-[9px] uppercase tracking-[3px] text-[#e8e4dc99]">Expertise</div>
        <div className="flex flex-wrap gap-2">
          {(expertise.length ? expertise : agent.github_data_summary.languages).slice(0, 4).map((item) => (
            <span key={item} className="border border-[#e8e4dc33] px-2 py-1 font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc]">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 font-mono text-[9px] uppercase tracking-[3px] text-[#e8e4dc99]">Code Ownership</div>
        <div className="flex flex-wrap gap-2">
          {(ownership.length ? ownership : agent.github_data_summary.top_files).slice(0, 3).map((item) => (
            <span key={item} className="border border-[#e8e4dc33] px-2 py-1 font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc]">
              {item}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-4 line-clamp-2 text-[13px] leading-relaxed text-[#e8e4dc99]">
        {collaborationBlurb(agent)}
      </p>

      <div className="mt-6 flex items-center justify-between border-t border-[#1f1f1f] pt-4">
        <span className="font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc66]">Memory v3 · 2 min ago</span>
        <span className="font-mono text-[10px] uppercase tracking-[2px] text-[#e8e4dc99]">{agent.constitution_facts.length} facts</span>
      </div>
    </motion.button>
  );
}
