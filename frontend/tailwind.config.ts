import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        fg: "var(--fg)",
        rule: { DEFAULT: "var(--rule)", dark: "var(--rule-dark)" },
        botanical: {
          green: "var(--green)",
          "green-light": "var(--green-light)",
          scarlet: "var(--scarlet)",
          "scarlet-light": "var(--scarlet-light)",
          amber: "var(--amber)",
          "amber-light": "var(--amber-light)",
        },
        rail: {
          bg: "var(--rail-bg)",
          fg: "var(--rail-fg)",
          muted: "var(--rail-muted)",
          border: "var(--rail-border)",
        },
      },
      fontFamily: {
        garamond: ["var(--font-garamond)", "Georgia", "serif"],
        body: ["var(--font-vietnam)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
