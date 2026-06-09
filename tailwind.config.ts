import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080808",
        muted: "#6f6f6f",
        line: "#e7e2dc",
        soft: "#faf8f5",
        paper: "#ffffff",
        gold: "#c08a2b",
        auri: "#00a8a8",
      },
      boxShadow: {
        card: "0 20px 60px rgba(8,8,8,0.06)",
      },
      fontFamily: {
        display: ["Georgia", "Times New Roman", "ui-serif", "serif"],
        body: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
