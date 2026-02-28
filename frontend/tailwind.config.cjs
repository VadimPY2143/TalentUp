/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#0b1a3a",
          800: "#10244b",
          700: "#152a57",
          600: "#1c3263",
        },
        sky: {
          50: "#f4f7fb",
          100: "#e9eff7",
        },
        orange: {
          300: "#ffb257",
          500: "#ff8a00",
          600: "#f07c00",
        },
      },
      fontFamily: {
        sans: ["Manrope", "Segoe UI", "Arial", "sans-serif"],
        display: ["Sora", "Segoe UI", "Arial", "sans-serif"],
      },
      boxShadow: {
        soft: "0 8px 20px rgba(10, 20, 40, 0.08)",
        medium: "0 12px 32px rgba(10, 20, 40, 0.14)",
        heavy: "0 20px 60px rgba(10, 25, 60, 0.18)",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.8s ease-out both",
        "fade-up-delay": "fadeUp 0.8s ease-out 0.2s both",
        fade: "fadeIn 0.6s ease-out both",
      },
    },
  },
  plugins: [],
}
