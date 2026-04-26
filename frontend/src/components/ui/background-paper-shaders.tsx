"use client";

import { DotOrbit, MeshGradient } from "@paper-design/shaders-react";

export function PaperShaderBackground({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden bg-[#080808] ${className}`}>
      <MeshGradient
        className="absolute inset-0 h-full w-full opacity-80"
        colors={["#080808", "#101010", "#1f1f1f", "#39ff14"]}
        speed={0.35}
        distortion={0.9}
        swirl={0.75}
        grainMixer={0.35}
        grainOverlay={0.18}
      />

      <div className="absolute inset-0 opacity-55">
        <DotOrbit
          className="h-full w-full"
          colors={["#39ff14", "#e8e4dc", "#1f1f1f", "#080808"]}
          colorBack="#080808"
          speed={0.8}
          scale={0.55}
          size={0.48}
          sizeRange={0.35}
          spreading={0.55}
        />
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,transparent_0%,transparent_28%,#08080866_62%,#080808_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#08080811_0%,#08080833_42%,#080808_100%)]" />
      <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(#e8e4dc_1px,transparent_1px),linear-gradient(90deg,#e8e4dc_1px,transparent_1px)] [background-size:80px_80px]" />
      <div className="absolute left-1/2 top-1/2 h-px w-[min(960px,90vw)] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#39ff14] to-transparent opacity-45" />
    </div>
  );
}
