// =====================================================================
// BUILD PARA PUBLICAÇÃO ESTÁTICA — Academia ConServ
// ---------------------------------------------------------------------
// Gera a aplicação com caminhos RELATIVOS (base "./"), para funcionar em
// qualquer pasta de qualquer servidor — inclusive numa pré-visualização
// hospedada, onde o app não fica na raiz do domínio.
//
// Faz também uma limpeza necessária: o arquivo auxiliar do leitor de PDF
// (pdf.worker) traz bytes de controle CRUS dentro de literais de texto.
// Publicadores de página recusam arquivos com esses bytes, e sem esse
// arquivo a leitura de PDF cai fora. A limpeza troca cada byte de
// controle pela sequência equivalente (\xNN) — mesmo valor para o
// JavaScript, arquivo inteiramente imprimível — e confere a sintaxe
// depois de reescrever.
//
//   npm run build:publicacao [-- pasta-de-saida]
// =====================================================================

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const saida = path.resolve(process.argv[2] ?? path.join(raiz, "dist-publicacao"));

console.log(`\nGerando em ${saida}\n`);
execFileSync("npx", ["vite", "build", "--base=./", "--outDir", saida, "--emptyOutDir"], {
  cwd: raiz,
  stdio: ["ignore", "inherit", "inherit"],
});

// Bytes de controle C0 (menos tab, LF e CR) e DEL.
const BYTES_DE_CONTROLE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

/** Troca bytes de controle crus pela sequência de escape equivalente. */
function limparBytesDeControle(arquivo) {
  const original = fs.readFileSync(arquivo, "latin1");
  let trocas = 0;
  const limpo = original.replace(BYTES_DE_CONTROLE, (c) => {
    trocas += 1;
    return `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`;
  });
  if (!trocas) return 0;
  fs.writeFileSync(arquivo, limpo, "latin1");
  // Se a troca tivesse quebrado o arquivo, isto falha e o build para.
  execFileSync(process.execPath, ["--check", arquivo], { stdio: ["ignore", "ignore", "inherit"] });
  console.log(`  limpo: assets/${path.basename(arquivo)} (${trocas} byte(s) reescrito(s))`);
  return 1;
}

const pastaAssets = path.join(saida, "assets");
let arquivosLimpos = 0;
for (const nome of fs.readdirSync(pastaAssets)) {
  if (!/\.(js|mjs)$/.test(nome)) continue;
  arquivosLimpos += limparBytesDeControle(path.join(pastaAssets, nome));
}
console.log(`\n${arquivosLimpos} arquivo(s) reescrito(s); sintaxe conferida.`);

console.log("\nArquivos a publicar:");
console.log(`  ${path.relative(raiz, path.join(saida, "academia.html"))}`);
for (const nome of fs.readdirSync(pastaAssets).sort()) {
  const kb = (fs.statSync(path.join(pastaAssets, nome)).size / 1024).toFixed(0);
  console.log(`  assets/${nome}  (${kb} KB)`);
}
console.log("");
