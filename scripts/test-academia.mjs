// Empacota e roda os testes da Academia ConServ:
//   · engines.test.ts          — integração dos motores (fluxo completo)
//   · content-integrity.test.ts — referências do catálogo (SOURCE_ID etc.)
// Usa o esbuild que já vem com o Vite — sem dependência extra.
import { build } from "esbuild";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outdir = mkdtempSync(join(tmpdir(), "academia-test-"));
const suites = ["engines", "content-integrity"];

await build({
  entryPoints: suites.map((nome) => `src/academia/__tests__/${nome}.test.ts`),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outdir,
  logLevel: "error",
  define: { "import.meta.env": "{}" },
});

function rodar(arquivo) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [arquivo], { stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

let falhou = 0;
for (const nome of suites) {
  console.log(`\n──────── ${nome} ────────`);
  falhou += await rodar(join(outdir, `${nome}.test.js`));
}
process.exit(falhou > 0 ? 1 : 0);
