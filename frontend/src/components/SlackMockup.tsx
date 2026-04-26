"use client";

import Image from "next/image";

interface Props {
  message: string;
  agentName: string;
  agentUsername: string;
}

function now() {
  const d = new Date();
  return `Today at ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() >= 12 ? "PM" : "AM"}`;
}

export function SlackMockup({ message, agentName, agentUsername }: Props) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-[#1e2d45] h-full min-h-[280px]">
      {/* Sidebar */}
      <div className="w-[180px] flex-shrink-0 bg-[#19171d] flex flex-col p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-white text-[12px] truncate">Engineering</span>
          <span className="text-[#717274] text-xs">▾</span>
        </div>
        <div className="space-y-0.5">
          {["# general", "# engineering", "# incidents", "# alerts"].map((ch, i) => (
            <div
              key={ch}
              className={[
                "px-2 py-1 rounded text-[11px] font-mono cursor-pointer",
                i === 2
                  ? "bg-[#ffffff18] text-white"
                  : "text-[#717274] hover:text-[#ccc]",
              ].join(" ")}
            >
              {ch}
            </div>
          ))}
        </div>
      </div>

      {/* Main pane */}
      <div className="flex-1 bg-[#1a1d21] flex flex-col min-w-0">
        {/* Channel header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#222529]">
          <span className="font-bold text-white text-[13px]"># incidents</span>
          <span className="text-[#717274] text-[11px]">P1 incidents and on-call coordination</span>
        </div>

        {/* Message */}
        <div className="flex-1 px-4 py-4 overflow-y-auto">
          <div className="flex gap-3">
            <Image
              src={`https://github.com/${agentUsername}.png?size=72`}
              alt={agentName}
              width={36}
              height={36}
              className="w-9 h-9 rounded flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-bold text-white text-[13px]">{agentName}</span>
                <span className="text-[11px] text-[#717274]">{now()}</span>
              </div>
              <p className="text-[13px] text-[#d1d2d3] leading-relaxed whitespace-pre-wrap">
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* Fake input */}
        <div className="mx-4 mb-3 border border-[#565856] rounded px-3 py-2">
          <span className="text-[12px] text-[#717274]">Message #incidents</span>
        </div>
      </div>
    </div>
  );
}
