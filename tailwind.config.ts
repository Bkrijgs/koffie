import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    // Thema-variant: geen enkele afgeronde hoek — alle radius-tokens
    // (inclusief rounded-full voor pills en dots) staan op 0.
    borderRadius: {
      none: "0px",
      sm: "0px",
      DEFAULT: "0px",
      md: "0px",
      lg: "0px",
      xl: "0px",
      "2xl": "0px",
      "3xl": "0px",
      full: "0px",
      xl2: "0px",
    },
    extend: {
      // Warm-minimalistisch palet: steenwit papier, warmgrijze inkt en
      // terracotta als accent (i.p.v. het koele blauw).
      colors: {
        paper: "#faf9f7",
        card: "#ffffff",
        kraft: "#f1efe9",
        line: "#e5e1d8",
        ink: {
          50: "#f5f4f0",
          100: "#e7e4dc",
          200: "#c8c3b5",
          300: "#a39d8c",
          400: "#7c7666",
          500: "#5c564a",
          600: "#3f3a31",
          700: "#2a261f",
          800: "#1a1713",
          900: "#0f0d0a",
        },
        clay: {
          300: "#e08e73",
          400: "#c96442",
          500: "#9a4a2f",
        },
        barista: {
          100: "#fde8d8",
          300: "#ea7c3c",
          400: "#c2410c",
          500: "#9a3412",
        },
        gold: {
          300: "#e5b969",
          400: "#cf9236",
          500: "#8f6320",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        display: [
          "var(--font-space-grotesk)",
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
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
        soft: "0 1px 0 rgba(26, 23, 19, 0.04), 0 1px 2px rgba(26, 23, 19, 0.04)",
        lift: "0 1px 0 rgba(26, 23, 19, 0.04), 0 8px 24px -12px rgba(26, 23, 19, 0.18)",
      },
    },
  },
  plugins: [],
  // Oude e-ink browsers (Kobo) ondersteunen geen `rgb(r g b / var(--tw-*))`-
  // kleursyntaxis. Door de opacity-coreplugins uit te zetten geeft Tailwind
  // platte hex-kleuren (bv. `#faf9f7`) i.p.v. de var-gebaseerde rgb-vorm.
  // Voor moderne browsers verandert er niets (bij volle dekking is hex
  // identiek); de losse `/opacity`-modifiers (bv. `bg-paper/85`) blijven werken.
  corePlugins: {
    backgroundOpacity: false,
    textOpacity: false,
    borderOpacity: false,
    divideOpacity: false,
    ringOpacity: false,
    placeholderOpacity: false,
  },
};

export default config;
