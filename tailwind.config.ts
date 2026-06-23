import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Strict legal palette: white, dark navy, gray, accent gold/green.
        navy: {
          DEFAULT: "#0f1f3d",
          light: "#1c2f54",
          dark: "#0a1730",
        },
        gold: {
          DEFAULT: "#b8902e",
          light: "#d4ac4a",
        },
        emerald: {
          DEFAULT: "#1f7a5a",
          light: "#2c9c73",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
