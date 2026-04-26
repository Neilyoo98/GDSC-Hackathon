import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/hooks/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        aubi: {
          bg: "#0a0e1a",
          surface: "#0d1224",
          surface2: "#111827",
          border: "#1e2d45",
          cyan: "#00f0ff",
          amber: "#ffaa00",
          red: "#ff3366",
          violet: "#8b5cf6",
          emerald: "#10b981",
          text: "#e2e8f0",
          muted: "#4a6080",
          dim: "#2a3f5f"
        }
      },
      fontFamily: {
        syne: ["var(--font-syne)", "Syne", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
        sans: ["var(--font-inter)", "Inter", "sans-serif"]
      },
      boxShadow: {
        cyan: "0 0 12px #00f0ff40, 0 0 24px #00f0ff20",
        red: "0 0 16px #ff336650, 0 0 32px #ff336620",
        emerald: "0 0 12px #10b98140, 0 0 24px #10b98120",
        violet: "0 0 12px #8b5cf640, 0 0 24px #8b5cf620",
        amber: "0 0 12px #ffaa0040, 0 0 24px #ffaa0020"
      }
    }
  },
  plugins: []
};

export default config;
