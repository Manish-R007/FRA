import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        canopy: {
          950: "#03110c",
          900: "#071a13",
          800: "#0c271c",
          700: "#143528",
          600: "#1c4a36",
        },
        moss: {
          300: "#9ee4b4",
          400: "#6fd392",
          500: "#3dba78",
          600: "#2a8f5a",
        },
        tribal: {
          gold: "#e2b45c",
          ochre: "#c4843a",
          terracotta: "#c45a32",
          parchment: "#f3ead6",
        },
      },
      fontFamily: {
        display: ["Cormorant Garamond", "Georgia", "serif"],
        sans: ["Sora", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(226, 180, 92, 0.18)",
        moss: "0 18px 50px rgba(8, 28, 20, 0.45)",
      },
    },
  },
  plugins: [],
};
export default config;
