import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-heading)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        ember: "rgb(var(--color-ember) / <alpha-value>)",
        mint: "rgb(var(--color-mint) / <alpha-value>)",
        sand: "rgb(var(--color-sand) / <alpha-value>)",
        panel: "rgb(var(--color-panel) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
      },
      boxShadow: {
        soft: "0 18px 60px rgba(24, 33, 43, 0.08)",
      },
      borderRadius: {
        xl2: "1.5rem",
      },
      backgroundImage: {
        "hero-glow": "radial-gradient(circle at top left, rgba(221, 107, 58, 0.18), transparent 40%), radial-gradient(circle at top right, rgba(54, 183, 138, 0.18), transparent 30%)",
      },
    },
  },
  plugins: [],
};

export default config;
