import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#000000",
        panel: "#111111",
        line: "#242424",
        mist: "#b5b5b5",
        accent: "#f4f4f5"
      },
      boxShadow: {
        glass: "0 16px 60px rgba(0, 0, 0, 0.36)",
        soft: "0 10px 30px rgba(0, 0, 0, 0.22)"
      },
      borderRadius: {
        "4xl": "2rem"
      },
      backdropBlur: {
        glass: "24px"
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out"
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ],
        brand: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
} satisfies Config;
