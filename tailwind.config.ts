import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy compatibility
        background: "var(--bg-primary)",
        foreground: "var(--text-primary)",

        // Brand Colors - LEGO Palette
        brand: {
          50: "#fff9e6",
          100: "#ffefb3",
          200: "#ffe580",
          300: "#ffdb4d",
          400: "#ffd44a",
          500: "#e6b100",
          600: "#b38800",
          700: "#806000",
          800: "#4d3800",
          900: "#1f1000",
        },
        lego: {
          yellow: "#ffd44a",
          red: "#e53935",
          blue: "#1e88e5",
          green: "#43a047",
          orange: "#ff9800",
          black: "#1d1d1d",
        },

        // Semantic Background Colors
        "background-primary": "var(--bg-primary)",
        "background-secondary": "var(--bg-secondary)",
        "background-tertiary": "var(--bg-tertiary)",

        // Semantic Foreground Colors
        "foreground-primary": "var(--text-primary)",
        "foreground-secondary": "var(--text-secondary)",
        "foreground-muted": "var(--text-muted)",

        // Surface Colors
        surface: "var(--surface-elevated)",

        // Border Colors
        border: "var(--border-default)",
        "border-subtle": "var(--border-subtle)",

        // Status Colors
        status: {
          success: "var(--color-success)",
          error: "var(--color-error)",
          warning: "var(--color-warning)",
          info: "var(--color-info)",
        },
      },
      fontFamily: {
        sans: ["Barlow", "system-ui", "sans-serif"],
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        product: "0 4px 6px rgba(0, 0, 0, 0.1)",
        "product-hover": "0 10px 20px rgba(0, 0, 0, 0.15)",
        card: "0 2px 8px rgba(0, 0, 0, 0.08)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
