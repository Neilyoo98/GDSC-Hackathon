"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import type { Agent, ConstitutionCategory } from "@/lib/types";

const CATEGORIES: { key: ConstitutionCategory; label: string; color: string }[] = [
  { key: "code_ownership", label: "[ CODE OWNERSHIP ]", color: "#3b82f6" },
  { key: "expertise",      label: "[ EXPERTISE ]",      color: "#f59e0b" },
  { key: "collaboration",  label: "[ COLLABORATION ]",  color: "#8b5cf6" },
  { key: "current_focus",  label: "[ CURRENT FOCUS ]",  color: "#00f0ff" },
  { key: "known_issues",   label: "[ KNOWN ISSUES ]",   color: "#ff3366" },
];

interface Props {
  agent: Agent | null;
  onClose: () => void;
}

export function DossierPanel({ agent, onClose }: Props) {
  const [tab, setTab] = useState<ConstitutionCategory>("code_ownership");

  const facts = agent?.constitution_facts.filter((f) => f.category === tab) ?? [];

  return (
    <AnimatePresence>
      {agent && (
        <motion.div
          key={agent.id}
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="flex flex-col h-full bg-[#0d1224] border-l border-[#1e2d45] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-[#1e2d45]">
            <div>
              <p className="font-mono text-[9px] text-[#4a6080] tracking-[0.15em] mb-2">
                {"// AGENT DOSSIER"}
              </p>
              <div className="flex items-center gap-3">
                <Image
                  src={`https://github.com/${agent.github_username}.png?size=64`}
                  alt={agent.name}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full border border-[#1e2d45]"
                />
                <div>
                  <p className="font-syne text-lg text-white leading-none">{agent.name}</p>
                  <p className="font-mono text-[10px] text-[#4a6080] mt-0.5">@{agent.github_username}</p>
                </div>
              </div>
              <p className="font-mono text-[11px] text-[#4a6080] mt-2">{agent.role}</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                {[
                  `${agent.github_data_summary.commit_count} commits`,
                  `${agent.github_data_summary.pr_count} PRs`,
                  agent.github_data_summary.languages.slice(0, 2).join(" / "),
                ].map((pill) => (
                  <span key={pill} className="font-mono text-[9px] text-[#4a6080] border border-[#1e2d45] bg-[#111827] px-2 py-0.5 rounded">
                    {pill}
                  </span>
                ))}
              </div>
            </div>
            <button onClick={onClose} className="text-[#4a6080] hover:text-white text-lg leading-none mt-1">
              ×
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#1e2d45] overflow-x-auto">
            {CATEGORIES.map(({ key, color }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={[
                  "font-mono text-[9px] tracking-wider uppercase px-3 py-2.5 whitespace-nowrap transition-colors flex-shrink-0",
                  tab === key
                    ? "text-white border-b-2"
                    : "text-[#4a6080] hover:text-[#8aa0c0]",
                ].join(" ")}
                style={tab === key ? { borderBottomColor: color } : {}}
              >
                {key.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Facts */}
          <div className="flex-1 overflow-y-auto aubi-scrollbar p-4 space-y-3">
            {facts.length === 0 ? (
              <p className="font-mono text-[11px] text-[#2a3f5f]">[ NO DATA ]</p>
            ) : (
              facts.map((fact, i) => {
                const meta = CATEGORIES.find((c) => c.key === fact.category);
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="border-l-2 pl-3 py-1"
                    style={{ borderColor: meta?.color ?? "#4a6080" }}
                  >
                    <p className="font-mono text-[9px] text-[#4a6080] uppercase tracking-wider mb-1">
                      {fact.predicate}
                    </p>
                    <p className="text-[12px] text-[#c8d6e8] leading-snug mb-1.5">{fact.object}</p>
                    {/* Confidence bar */}
                    <div className="flex items-center gap-2">
                      <div className="h-0.5 w-20 bg-[#1e2d45] rounded overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${fact.confidence * 100}%` }}
                          transition={{ delay: i * 0.06 + 0.1, duration: 0.5 }}
                          className="h-full rounded"
                          style={{ backgroundColor: meta?.color ?? "#4a6080" }}
                        />
                      </div>
                      <span className="font-mono text-[9px] text-[#2a3f5f]">
                        {Math.round(fact.confidence * 100)}%
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-[#1e2d45]">
            <p className="font-mono text-[9px] text-[#2a3f5f]">
              CONSTITUTION · {agent.constitution_facts.length} FACTS INDEXED
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
