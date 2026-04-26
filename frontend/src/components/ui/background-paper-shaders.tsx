"use client";

import { MeshGradient } from "@paper-design/shaders-react";

export function PaperShaderBackground({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden bg-[#080808] ${className}`}>
      <MeshGradient
        className="absolute inset-0 h-full w-full opacity-90"
        colors={["#080808", "#111111", "#27331f", "#39ff14", "#e8e4dc"]}
        speed={0.55}
        distortion={0.85}
        swirl={0.62}
        grainMixer={0.42}
        grainOverlay={0.12}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,transparent_0%,transparent_30%,#08080866_64%,#080808_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#08080822_0%,#08080800_24%,#08080888_78%,#080808_100%)]" />
      <div className="absolute left-[18%] top-[18%] h-40 w-40 rounded-full bg-[#39ff14]/10 blur-3xl animate-pulse [animation-duration:4s]" />
      <div className="absolute bottom-[28%] right-[18%] h-32 w-32 rounded-full bg-[#e8e4dc]/5 blur-3xl animate-pulse [animation-delay:1s] [animation-duration:3s]" />
      <div className="absolute right-[34%] top-[46%] h-28 w-28 rounded-full bg-[#39ff14]/[0.06] blur-2xl animate-pulse [animation-delay:0.5s] [animation-duration:5s]" />
    </div>
  );
}
