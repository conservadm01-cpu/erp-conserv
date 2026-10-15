import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { verifySchema } from "@/server/validation/phase3";
import { verifyCompany } from "@/server/services/company.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => {
  const { source } = await readJson(req, verifySchema);
  return json({ company: await verifyCompany(actor, uuid.parse(params.id), source, meta) });
});
