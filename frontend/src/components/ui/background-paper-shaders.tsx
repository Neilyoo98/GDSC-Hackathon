"use client";

import { MeshGradient } from "@paper-design/shaders-react";

export function PaperShaderBackground({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden bg-black ${className}`}>
      <MeshGradient
        className="absolute inset-0 h-full w-full"
        colors={["#000000", "#1a1a1a", "#333333", "#ffffff"]}
        speed={1}
        distortion={1}
        swirl={0.8}
        grainMixer={0.25}
        grainOverlay={0.08}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,transparent_0%,transparent_32%,#00000055_68%,#000000_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#00000011_0%,#00000000_28%,#00000088_78%,#000000_100%)]" />
      <div className="absolute left-1/3 top-1/4 h-32 w-32 rounded-full bg-gray-800/5 blur-3xl animate-pulse [animation-duration:3s]" />
      <div className="absolute bottom-1/3 right-1/4 h-24 w-24 rounded-full bg-white/[0.02] blur-2xl animate-pulse [animation-delay:1s] [animation-duration:2s]" />
      <div className="absolute right-1/3 top-1/2 h-20 w-20 rounded-full bg-gray-900/[0.03] blur-xl animate-pulse [animation-delay:0.5s] [animation-duration:4s]" />
    </div>
  );
}
