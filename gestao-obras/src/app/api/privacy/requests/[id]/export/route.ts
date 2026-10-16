import { authedRoute } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { exportSubjectData } from "@/server/services/privacy.service";

export const GET = authedRoute<{ id: string }>(async ({ actor, params, meta }) => {
  const data = await exportSubjectData(actor, uuid.parse(params.id), meta);
  return new Response(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="dados-titular-${params.id.slice(0, 8)}.json"` },
  });
});
