"use client";
import { useEffect, useRef } from "react";

export function PerspectiveGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    let raf: number;
    // Vanishing point as normalized [0,1] coords, target + smoothed current
    const target = { x: 0.5, y: 0.42 };
    const vp     = { x: 0.5, y: 0.42 };

    const resize = () => {
      el.width  = el.offsetWidth;
      el.height = el.offsetHeight;
    };

    const tick = () => {
      // Smooth follow
      vp.x += (target.x - vp.x) * 0.055;
      vp.y += (target.y - vp.y) * 0.055;

      const W   = el.width;
      const H   = el.height;
      const vpX = vp.x * W;
      const vpY = vp.y * H;

      ctx.clearRect(0, 0, W, H);

      const V_LINES       = 20;
      const H_LINES_FLOOR = 14;
      const H_LINES_CEIL  = 8;

      // ── Fan lines (vertical, radiating from VP to all 4 edges) ──────────
      for (let i = 0; i <= V_LINES; i++) {
        const t    = i / V_LINES;
        const edgeX = t * W;
        const distC = Math.abs(t - 0.5) * 2;          // 0 at center, 1 at edge
        const alpha = (1 - distC * 0.65) * 0.16;

        // To bottom
        ctx.beginPath();
        ctx.moveTo(vpX, vpY);
        ctx.lineTo(edgeX, H);
        ctx.strokeStyle = `rgba(0,240,255,${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // To top (subtler)
        ctx.beginPath();
        ctx.moveTo(vpX, vpY);
        ctx.lineTo(edgeX, 0);
        ctx.strokeStyle = `rgba(0,240,255,${(alpha * 0.5).toFixed(3)})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // ── Floor horizontals (below VP) — perspective spaced ───────────────
      for (let i = 1; i <= H_LINES_FLOOR; i++) {
        const t  = Math.pow(i / H_LINES_FLOOR, 1.5);
        const y  = vpY + t * (H - vpY);
        const x0 = vpX - t * vpX;
        const x1 = vpX + t * (W - vpX);
        const alpha = t * 0.32;

        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.strokeStyle = `rgba(0,240,255,${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // ── Ceiling horizontals (above VP) — subtler ────────────────────────
      for (let i = 1; i <= H_LINES_CEIL; i++) {
        const t  = Math.pow(i / H_LINES_CEIL, 1.5);
        const y  = vpY - t * vpY;
        const x0 = vpX - t * vpX;
        const x1 = vpX + t * (W - vpX);
        const alpha = t * 0.13;

        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.strokeStyle = `rgba(0,240,255,${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      // Clamp VP to a tasteful range so it doesn't go to extreme edges
      target.x = 0.3 + (e.clientX / window.innerWidth)  * 0.4;
      target.y = 0.28 + (e.clientY / window.innerHeight) * 0.28;
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
