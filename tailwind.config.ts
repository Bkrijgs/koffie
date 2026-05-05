import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#faf7f1",
        card: "#ffffff",
        kraft: "#ece2cd",
        line: "#cfd5e8",
        ink: {
          50: "#f1ebde",
          100: "#dccfb6",
          200: "#b29a78",
          300: "#7d6443",
          400: "#544023",
          500: "#382815",
          600: "#241a0e",
          700: "#15100a",
          800: "#0d0905",
          900: "#070403",
        },
        clay: {
          300: "#d59a7d",
          400: "#b8754f",
          500: "#8e5535",
        },
        barista: {
          100: "#dde0fb",
          300: "#5b66ed",
          400: "#1e2ceb",
          500: "#1622b8",
        },
        gold: {
          300: "#d8b07a",
          400: "#b88c44",
          500: "#876230",
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
