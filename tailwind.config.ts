import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // l8r brand colors - fintech dark theme
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#00D4AA", // l8r teal/mint
          50: "#E6FFF9",
          100: "#B3FFE9",
          200: "#80FFD9",
          300: "#4DFFC9",
          400: "#1AFFBA",
          500: "#00D4AA",
          600: "#00A888",
          700: "#007D66",
          800: "#005244",
          900: "#002722",
        },
        secondary: {
          DEFAULT: "#6366F1", // Indigo accent
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [typography],
};
export default config;
