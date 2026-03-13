import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 24px 80px rgba(15, 23, 42, 0.16)",
        soft: "0 10px 35px rgba(15, 23, 42, 0.1)"
      },
      colors: {
        paper: "#fdf7ec",
        ink: "#172033"
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -10px, 0)" }
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translate3d(0, 16px, 0)" },
          "100%": { opacity: "1", transform: "translate3d(0, 0, 0)" }
        }
      },
      animation: {
        drift: "drift 8s ease-in-out infinite",
        "fade-up": "fadeUp 500ms ease-out both"
      }
    }
  },
  plugins: []
};

export default config;

