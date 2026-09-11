import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Duas aplicações no mesmo projeto:
//   index.html     -> ERP ConServ (produção, estoque, compras)
//   academia.html  -> Academia ConServ (capacitação)
// Ambas compartilham o mesmo banco (Supabase) e o mesmo deploy.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@academia": fileURLToPath(new URL("./src/academia", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        academia: fileURLToPath(new URL("./academia.html", import.meta.url)),
      },
    },
  },
});
