// Empacota e roda o teste de integração da Academia ConServ.
// Usa o esbuild que já vem com o Vite — sem dependência extra.
import { build } from "esbuild";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outdir = mkdtempSync(join(tmpdir(), "academia-test-"));
const outfile = join(outdir, "engines.test.mjs");

await build({
  entryPoints: ["src/academia/__tests__/engines.test.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outfile,
  logLevel: "error",
  define: { "import.meta.env": "{}" },
});

const child = spawn(process.execPath, [outfile], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
