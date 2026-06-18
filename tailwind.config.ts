import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Aligned with the AURI product site design tokens.
        ink: "#1D1B17",
        muted: "#6F6A60",
        faint: "#9A9488",
        line: "#E9E2D6",
        soft: "#F0EADE",
        paper: "#FBF8F2",
        card: "#FFFFFF",
        mint: "#2E7B5B",
        "mint-deep": "#1F5C42",
        "mint-soft": "#EAF6EF",
        coral: "#FF7A59",
        "coral-soft": "#FFE6DD",
        violet: "#9D6BF2",
        "violet-soft": "#EEE6FE",
        gold: "#c08a2b",
        auri: "#2E7B5B",
      },
      boxShadow: {
        card: "0 1px 2px rgba(29,27,23,0.04), 0 8px 30px rgba(29,27,23,0.06)",
        "card-lg": "0 2px 6px rgba(29,27,23,0.05), 0 24px 60px rgba(29,27,23,0.10)",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "ui-serif", "serif"],
        body: ["'Nunito Sans'", "Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        hand: ["Caveat", "ui-serif", "cursive"],
      },
    },
  },
  plugins: [],
};

export default config;
