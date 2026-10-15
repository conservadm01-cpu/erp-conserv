/**
 * Ancoragem externa da trilha de auditoria. Gera uma linha com o último número
 * de sequência e o hash correspondente; guarde essa linha fora do servidor de
 * banco (armazenamento imutável/WORM, e-mail para o comitê, cofre). Se a cadeia
 * for adulterada por quem controla o banco, a comparação com a âncora revela.
 *   npm run audit:anchor            -> imprime a âncora
 *   npm run audit:anchor -- verify <seq> <hash>  -> confere uma âncora antiga
 */
import "dotenv/config";
import { prisma } from "../src/server/db";
import { verifyAuditChain } from "../src/server/audit/audit";

async function main() {
  const [, , cmd, seq, hash] = process.argv;
  const chain = await verifyAuditChain();
  if (!chain.ok) {
    console.error(`CADEIA INCONSISTENTE no registro ${chain.brokenAtSeq}: ${chain.reason}`);
    process.exitCode = 2;
    return;
  }
  if (cmd === "verify") {
    const ev = await prisma.auditEvent.findUnique({ where: { seq: BigInt(seq ?? "0") }, select: { hash: true } });
    const ok = ev?.hash === hash;
    console.log(ok ? "Âncora confere com a trilha atual." : "Âncora NÃO confere: a trilha foi alterada ou a âncora é de outro banco.");
    process.exitCode = ok ? 0 : 3;
    return;
  }
  const last = await prisma.auditEvent.findFirst({ orderBy: { seq: "desc" }, select: { seq: true, hash: true, occurredAt: true } });
  console.log(JSON.stringify({ geradaEm: new Date().toISOString(), registros: chain.checked, ultimoSeq: last?.seq.toString() ?? "0", hash: last?.hash ?? null, ultimoEvento: last?.occurredAt ?? null }));
}

main().finally(() => prisma.$disconnect());
