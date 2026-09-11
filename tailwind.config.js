/**
 * Tailwind fica restrito à Academia ConServ (src/academia + academia.html).
 * O ERP antigo (index.html / src/App.jsx) usa estilos inline e não importa
 * o CSS da Academia, então continua funcionando exatamente como antes.
 */
export default {
  content: ["./academia.html", "./src/academia/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta herdada do ERP ConServ (continuidade visual da marca)
        navy: { DEFAULT: "#2f4a63", 700: "#27405a", 800: "#1f354c", 900: "#1c2b39" },
        linen: { DEFAULT: "#f4efe2", 50: "#fffdf7", 100: "#f8f4ea", 200: "#efe7d4" },
        sand: { DEFAULT: "#cdb98a", 300: "#ddcda6", 500: "#bda472", 700: "#a3937a" },
        ink: { DEFAULT: "#2a2015", 600: "#6b5d49", 400: "#a3937a" },
        copper: { DEFAULT: "#c2703d", 600: "#a85c2d", 300: "#e0a33e" },
        jade: { DEFAULT: "#3f7d63", 600: "#336650", 300: "#8fc0aa" },
        alert: { DEFAULT: "#c0392b", 300: "#e8a49c" },
      },
      fontFamily: {
        sans: ['"Inter"', "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "Roboto", "sans-serif"],
        display: ['"Inter"', "-apple-system", '"Segoe UI"', "sans-serif"],
        mono: ['"SFMono-Regular"', "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,43,57,.06), 0 8px 24px -12px rgba(28,43,57,.18)",
        lift: "0 2px 4px rgba(28,43,57,.08), 0 18px 40px -18px rgba(28,43,57,.28)",
        inset: "inset 0 1px 0 rgba(255,255,255,.5)",
      },
      borderRadius: { xl2: "1.25rem" },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "none" } },
        "pop-in": { "0%": { opacity: "0", transform: "scale(.94)" }, "100%": { opacity: "1", transform: "none" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        "xp-float": { "0%": { opacity: "0", transform: "translateY(6px) scale(.9)" }, "30%": { opacity: "1" }, "100%": { opacity: "0", transform: "translateY(-22px) scale(1)" } },
      },
      animation: {
        "fade-up": "fade-up .32s ease-out both",
        "pop-in": "pop-in .22s ease-out both",
        shimmer: "shimmer 1.6s linear infinite",
        "xp-float": "xp-float 1.4s ease-out both",
      },
    },
  },
  plugins: [],
};
