import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        secondary: "var(--bg-secondary)",
        card: "var(--card)",
        primary: "var(--gold)",
        primaryBright: "var(--gold-bright)",
        primaryDeep: "var(--gold-deep)",
        onPrimary: "var(--on-gold)",
        danger: "var(--red)",
        foreground: "var(--text)",
        muted: "var(--text-secondary)",
        border: "var(--border)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
