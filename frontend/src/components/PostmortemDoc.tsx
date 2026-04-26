"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  markdown: string;
}

export function PostmortemDoc({ markdown }: Props) {
  return (
    <div className="flex flex-col rounded-lg overflow-hidden border border-[#1e2d45] h-full min-h-[280px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0d1224] border-b border-[#1e2d45] flex-shrink-0">
        <span className="font-mono text-[10px] text-[#4a6080]">POSTMORTEM.md</span>
        <span className="font-mono text-[9px] text-[#ff3366] border border-[#ff336644] px-1.5 py-0.5 rounded tracking-widest">
          DRAFT
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto aubi-scrollbar px-5 py-4 bg-[#0a0e1a]">
        <div className="prose-aubi">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => (
                <h2 className="font-syne text-sm text-white border-b border-[#1e2d45] pb-1 mb-3 mt-4 first:mt-0">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="font-mono text-[10px] text-[#00f0ff] uppercase tracking-wider mb-2 mt-3">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="text-[12px] text-[#8899aa] leading-relaxed mb-2">{children}</p>
              ),
              ul: ({ children }) => <ul className="space-y-1 mb-2 pl-3">{children}</ul>,
              li: ({ children }) => (
                <li className="text-[12px] text-[#8899aa] flex gap-2">
                  <span className="text-[#00f0ff] mt-px flex-shrink-0">›</span>
                  <span>{children}</span>
                </li>
              ),
              code: ({ children }) => (
                <code className="bg-[#111827] px-1 rounded font-mono text-[10px] text-[#c8d6e8]">
                  {children}
                </code>
              ),
              hr: () => <hr className="border-[#1e2d45] my-3" />,
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
