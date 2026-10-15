/**
 * Rotinas diárias. Agende uma vez por dia (cron, agendador do provedor ou
 * Agendador de Tarefas do Windows):  npm run jobs:daily
 */
import "dotenv/config";
import { prisma } from "../src/server/db";
import { markExpiredDocuments } from "../src/server/services/document.service";
import { recordAudit } from "../src/server/audit/audit";
import { systemMeta } from "../src/server/http/request-meta";

async function main() {
  const expired = await markExpiredDocuments(prisma);
  await recordAudit({ action: "sistema.rotina_diaria", actorLabel: "rotina", metadata: { documentosVencidos: expired } }, systemMeta("rotina-diaria"));
  console.log(`Documentos marcados como vencidos: ${expired}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
