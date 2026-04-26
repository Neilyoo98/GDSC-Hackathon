"use client";
import { useEffect, useRef } from "react";

const CELL     = 64;   // grid cell size in px
const PARALLAX = 24;   // max offset the grid drifts in px
const SPEED    = 0.06; // lerp speed

export function PerspectiveGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    let raf: number;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };

    const resize = () => {
      el.width  = el.offsetWidth;
      el.height = el.offsetHeight;
    };

    const tick = () => {
      current.x += (target.x - current.x) * SPEED;
      current.y += (target.y - current.y) * SPEED;

      const W = el.width;
      const H = el.height;

      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(0,240,255,0.12)";
      ctx.lineWidth = 0.5;

      // Offset origin so the grid drifts with cursor
      const ox = ((current.x % CELL) + CELL) % CELL;
      const oy = ((current.y % CELL) + CELL) % CELL;

      // Vertical lines
      for (let x = ox - CELL; x < W + CELL; x += CELL) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = oy - CELL; y < H + CELL; y += CELL) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      // Map cursor position to ±PARALLAX offset
      target.x = (e.clientX / window.innerWidth  - 0.5) * PARALLAX * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * PARALLAX * 2;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    tick();

    window.addEventListener("mousemove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 0, pointerEvents: "none" }}
    />
  );
}
