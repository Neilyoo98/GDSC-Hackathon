"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

interface Step {
  number: string;
  title: string;
  description: string;
  tag: string;
  hot?: boolean;
}

export function StepCard({ step, index }: { step: Step; index: number }) {
  const cardRef  = useRef<HTMLDivElement>(null);
  const inView   = useInView(cardRef, { once: true, margin: "-60px" });
  const [glow, setGlow] = useState({ x: 50, y: 50, visible: false });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current!.getBoundingClientRect();
    setGlow({
      x: ((e.clientX - rect.left) / rect.width)  * 100,
      y: ((e.clientY - rect.top)  / rect.height) * 100,
      visible: true,
    });
  };

  const accent = step.hot ? "#39ff14" : "#00f0ff";

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setGlow((g) => ({ ...g, visible: false }))}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className="group relative overflow-hidden"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* ── Liquid glass background ───────────────────────────────────────── */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at ${glow.x}% ${glow.y}%, ${accent}14 0%, transparent 65%)`,
          opacity: glow.visible ? 1 : 0,
        }}
      />

      {/* Frosted glass card surface */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)",
          backdropFilter: "blur(1px)",
        }}
      />

      {/* Left accent line */}
      <motion.div
        className="absolute left-0 top-0 bottom-0 w-px"
        style={{ background: `linear-gradient(to bottom, transparent, ${accent}, transparent)` }}
        initial={{ scaleY: 0, opacity: 0 }}
        animate={glow.visible ? { scaleY: 1, opacity: 1 } : { scaleY: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
      />

      {/* Top shimmer line on hover */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(to right, transparent, ${accent}80, transparent)`,
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={glow.visible ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
        transition={{ duration: 0.4 }}
      />

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="relative grid grid-cols-[96px_1px_1fr] py-9 md:grid-cols-[120px_1px_1fr]">

        {/* Number */}
        <motion.div
          className="font-syne leading-none tracking-[4px] select-none"
          style={{ fontSize: "clamp(52px, 6vw, 72px)" }}
          animate={{ color: glow.visible ? `${accent}55` : "#e8e4dc12" }}
          transition={{ duration: 0.3 }}
        >
          {step.number}
        </motion.div>

        {/* Divider */}
        <div
          className="transition-all duration-300"
          style={{
            background: glow.visible
              ? `linear-gradient(to bottom, transparent, ${accent}60, transparent)`
              : "#1f1f1f",
          }}
        />

        {/* Text */}
        <div className="pl-6 md:pl-10 flex flex-col justify-center">
          <motion.h3
            className="font-medium leading-snug transition-colors duration-300"
            style={{ fontSize: "clamp(14px, 1.5vw, 17px)" }}
            animate={{ color: glow.visible ? "#ffffff" : "#e8e4dc" }}
          >
            {step.title}
          </motion.h3>

          <p className="mt-2 max-w-[600px] text-[12px] leading-[1.9] text-[#e8e4dc55] group-hover:text-[#e8e4dc80] transition-colors duration-300">
            {step.description}
          </p>

          <motion.span
            className="mt-3 font-mono text-[9px] uppercase tracking-[2.5px] inline-block"
            animate={{ color: glow.visible ? accent : step.hot ? "#39ff1488" : "#e8e4dc33" }}
            transition={{ duration: 0.3 }}
          >
            {step.tag}
          </motion.span>
        </div>
      </div>

      {/* Corner decoration */}
      <div
        className="absolute bottom-3 right-4 font-mono text-[8px] tracking-[2px] transition-all duration-300 opacity-0 group-hover:opacity-40 select-none"
        style={{ color: accent }}
      >
        ▸
      </div>
    </motion.div>
  );
}
