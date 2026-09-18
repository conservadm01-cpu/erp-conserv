// =====================================================================
// BUILD EM ARQUIVO ÚNICO — Academia ConServ
// ---------------------------------------------------------------------
// Gera UM arquivo .html com tudo dentro (código, estilos, conteúdo
// inicial). Serve para levar a Academia num pendrive, mandar por
// e-mail/WhatsApp ou abrir com duplo clique, sem servidor nenhum.
//
// Limitação honesta do formato: aberto direto do disco (file://), o
// navegador não libera armazenamento local, então o progresso vale só
// enquanto a aba estiver aberta. Para uso de verdade, publique a pasta
// do `npm run build:publicacao` num servidor.
//
//   npm run build:arquivo-unico [-- caminho-de-saida.html]
// =====================================================================

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "vite";
import react from "@vitejs/plugin-react";

const raiz = path.resolve(import.meta.dirname, "..");
const destino = path.resolve(process.argv[2] ?? path.join(raiz, "academia-arquivo-unico.html"));
const temporaria = fs.mkdtempSync(path.join(os.tmpdir(), "academia-unico-"));

console.log("\nGerando a Academia em arquivo único…\n");
await build({
  root: raiz,
  base: "./",
  logLevel: "warn",
  plugins: [react()],
  resolve: { alias: { "@academia": path.join(raiz, "src/academia") } },
  build: {
    outDir: temporaria,
    emptyOutDir: true,
    cssCodeSplit: false,
    // Sem pedaços separados: tudo vira um só arquivo de código.
    rollupOptions: {
      input: path.join(raiz, "academia.html"),
      output: { inlineDynamicImports: true, entryFileNames: "app.js", assetFileNames: "app.[ext]" },
    },
  },
});

/** Procura o arquivo gerado, esteja ele na raiz ou em assets/. */
function acharGerado(extensao) {
  for (const pasta of [temporaria, path.join(temporaria, "assets")]) {
    if (!fs.existsSync(pasta)) continue;
    const achado = fs.readdirSync(pasta).find((n) => n.endsWith(extensao));
    if (achado) return path.join(pasta, achado);
  }
  return null;
}

const caminhoJs = acharGerado(".js");
const caminhoCss = acharGerado(".css");
if (!caminhoJs) throw new Error("não encontrei o arquivo de código gerado");

const js = fs.readFileSync(caminhoJs, "utf8");
const css = caminhoCss ? fs.readFileSync(caminhoCss, "utf8") : "";
let html = fs.readFileSync(path.join(temporaria, "academia.html"), "utf8");

// Troca as referências externas pelo conteúdo, na mesma posição.
html = html
  .replace(/<script type="module"[^>]*src="[^"]*"><\/script>/, "@@CODIGO@@")
  .replace(/<link rel="stylesheet"[^>]*href="\.\/[^"]*\.css"\s*\/?>/, "@@ESTILO@@")
  .replace(/<link rel="modulepreload"[^>]*>/g, "")
  .replace(/<link rel="manifest"[^>]*>/g, "")
  .replace(/<link rel="icon"[^>]*>/g, "")
  .replace(/<link rel="apple-touch-icon"[^>]*>/g, "");

// Sequências que fariam o leitor de HTML fechar a tag cedo demais ou
// entrar em modo de comentário no meio do código.
const jsSeguro = js
  .replace(/<\/script>/gi, "<\\/script>")
  .replace(/<!--/g, "<\\!--")
  .replace(/<script/gi, "<\\script");

// ATENÇÃO: a substituição vai numa FUNÇÃO de propósito. Com texto, o
// JavaScript interpreta "$&", "$`" e "$'" dentro do conteúdo e injeta
// pedaços do próprio documento no meio do código — foi assim que a
// primeira versão deste arquivo nasceu quebrada.
html = html
  .replace("@@ESTILO@@", () => `<style>${css}</style>`)
  .replace("@@CODIGO@@", () => `<script type="module">${jsSeguro}</script>`);

fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, html, "utf8");
fs.rmSync(temporaria, { recursive: true, force: true });

const mb = (fs.statSync(destino).size / 1024 / 1024).toFixed(1);
console.log(`Pronto: ${path.relative(raiz, destino)}  (${mb} MB)`);
console.log("Abra com duplo clique ou publique em qualquer servidor.\n");
