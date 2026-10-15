import { z } from "zod";
import { authedRoute, readQuery } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { Errors } from "@/server/http/errors";
import { generateReport, REPORTS, type ReportType } from "@/server/services/reports-extra.service";

const q = z.object({ workId: uuid.optional(), unitId: uuid.optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), action: z.string().max(80).optional() });

export const GET = authedRoute<{ type: string }>(async ({ req, actor, params, meta }) => {
  if (!(params.type in REPORTS)) throw Errors.notFound("Relatório");
  const { pdf, fileName } = await generateReport(actor, params.type as ReportType, readQuery(req, q), meta);
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fileName}"` } });
});
