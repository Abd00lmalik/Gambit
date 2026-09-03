import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        carbon: { DEFAULT: "#1E2526", light: "#2A3334", lighter: "#354042" },
        teal: { DEFAULT: "#19BEA4", dark: "#149E89", light: "#22D4B7" },
        foam: { DEFAULT: "#D7FAFC", dark: "#B0F0F5" },
        up: { DEFAULT: "#6FCF97", muted: "#4CAF7D" },
        down: { DEFAULT: "#E07A7A", muted: "#C45A5A" },
      },
      fontFamily: {
        display: ["Unbounded", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        ui: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      animation: {
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "shimmer": "shimmer 3s ease-in-out infinite",
        "orb-breathe": "orb-breathe 6s ease-in-out infinite",
        "coin-spin": "coin-spin 8s linear infinite",
        "ticker": "ticker-scroll 30s linear infinite",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        "orb-breathe": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.5" },
          "50%": { transform: "scale(1.08)", opacity: "0.7" },
        },
        "coin-spin": {
          from: { transform: "rotateY(0deg)" },
          to: { transform: "rotateY(360deg)" },
        },
        "ticker-scroll": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.3)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
