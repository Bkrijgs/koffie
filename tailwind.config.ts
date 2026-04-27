import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f6f1e8",
        card: "#ffffff",
        line: "#e6dccb",
        ink: {
          50: "#f4ede0",
          100: "#e2d3bc",
          200: "#c0a880",
          300: "#967a52",
          400: "#6e5638",
          500: "#4d3b25",
          600: "#352818",
          700: "#241a10",
          800: "#15100a",
          900: "#0a0805",
        },
        gold: {
          300: "#dcb676",
          400: "#cf9d4d",
          500: "#b1812f",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        display: [
          "ui-serif",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "Times",
          "serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      letterSpacing: {
        tightish: "-0.01em",
        tighter2: "-0.02em",
      },
      boxShadow: {
        soft: "0 1px 0 rgba(36, 26, 16, 0.04), 0 1px 2px rgba(36, 26, 16, 0.04)",
        lift: "0 1px 0 rgba(36, 26, 16, 0.04), 0 8px 24px -12px rgba(36, 26, 16, 0.18)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
