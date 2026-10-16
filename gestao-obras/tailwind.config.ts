import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4fb",
          100: "#d6e4f4",
          500: "#2f6db3",
          600: "#245a96",
          700: "#1c4878",
          900: "#10294a",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
