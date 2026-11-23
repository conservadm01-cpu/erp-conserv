// Gera a versão de demonstração (um único HTML) para publicar como artefato:
//   node demo/build.mjs [saida.html]
// Usa os componentes reais do app; troca apenas o Supabase e os links de vídeo
// por versões em memória (demo/fakeSupabase.ts, demo/videoUrls.ts).
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const out = process.argv[2] ?? resolve(here, "dist/construcam-demo.html");

const swap = {
  "@/lib/supabase": resolve(here, "fakeSupabase.ts"),
  "@/lib/videoUrls": resolve(here, "videoUrls.ts"),
  "react": resolve(here, "react-shim.js"),
  "react-dom": resolve(here, "react-dom-shim.js"),
  "react-dom/client": resolve(here, "react-dom-shim.js"),
  "react/jsx-runtime": resolve(here, "jsx-shim.js")
};

const result = await build({
  entryPoints: [resolve(here, "main.tsx")],
  bundle: true, write: false, minify: true, format: "iife", target: "es2020",
  jsx: "automatic", tsconfig: resolve(root, "tsconfig.json"),
  logLevel: "warning", logOverride: { "unsupported-directive": "silent" },
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{
    name: "demo-swap",
    setup(b) {
      b.onResolve({ filter: /^(@\/lib\/(supabase|videoUrls)|react|react-dom|react-dom\/client|react\/jsx-runtime)$/ }, a => ({ path: swap[a.path] }));
    }
  }]
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync(resolve(root, "src/app/globals.css"), "utf8") + "\n" + readFileSync(resolve(here, "demo.css"), "utf8");
const html = `<title>Construcam Obra 360</title>
<meta name="theme-color" content="#eef2f6">
<style>
${css}
</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>
${js}
</script>
`;
writeFileSync(out, html);
console.log(`ok: ${out} (${(html.length / 1024).toFixed(0)} KB)`);
