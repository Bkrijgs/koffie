import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        crema: {
          50: "#fbf6ef",
          100: "#f3e7d3",
          200: "#e6cfa6",
          300: "#d4b079",
          400: "#c39558",
          500: "#a87a3f",
          600: "#8a6132",
          700: "#6c4a28",
          800: "#4d3520",
          900: "#33231a",
        },
        espresso: {
          50: "#f6efe9",
          100: "#e6d6c7",
          200: "#c8a886",
          300: "#a87f5c",
          400: "#7e5a3d",
          500: "#5b3f2c",
          600: "#432d20",
          700: "#2f1f17",
          800: "#1f140f",
          900: "#130b08",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(51, 35, 26, 0.06), 0 4px 16px rgba(51, 35, 26, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
