import { authedRoute } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { generateInspectionReport } from "@/server/services/report.service";

export const GET = authedRoute<{ id: string }>(async ({ actor, params, meta }) => {
  const { pdf, fileName } = await generateInspectionReport(actor, uuid.parse(params.id), meta);
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fileName}"` } });
});
