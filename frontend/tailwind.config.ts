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
          bg: "#080808",
          text: "#e8e4dc",
          accent: "#39ff14",
          divider: "#1f1f1f"
        }
      },
      fontFamily: {
        syne: ["var(--font-display)", "Bebas Neue", "sans-serif"],
        mono: ["var(--font-mono)", "IBM Plex Mono", "monospace"],
        sans: ["var(--font-body)", "IBM Plex Sans", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
