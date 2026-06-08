import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0d0f1a",
        paper: "#f0ede6",
        accent: "#7C6FE0"
      },
      fontFamily: {
        ui: ["var(--font-ui)", "system-ui", "sans-serif"],
        novel: ["var(--font-lora)", "serif"]
      }
    }
  },
  plugins: []
};

export default config;
