import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Paleta institucional CAD Venezuela (Manual de Marca v1.0)
        navy: "#012D37",
        green: "#008747",
        orange: "#F77B1C",
        amber: "#F8B345",
        greenLight: "#82C35A",
        yellowGreen: "#E6E150",
        info: "#2E6B8C",
        danger: "#B23A3A",
        ink: "#333333",
        dim: "#666666",
        line: "#E5E7E8",
        surface: "#F4F4F4",
        paper: "#FFFFFF",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
        sans: ["var(--font-sans)"],
      },
    },
  },
  plugins: [],
};
export default config;
