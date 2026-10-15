import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { waiveSchema } from "@/server/validation/requirement";
import { waiveEvaluation } from "@/server/services/requirement.service";

export const POST = authedRoute<{ id: string; evaluationId: string }>(async ({ req, actor, params, meta }) => {
  const { justification } = await readJson(req, waiveSchema);
  return json({ evaluation: await waiveEvaluation(actor, uuid.parse(params.id), uuid.parse(params.evaluationId), justification, meta) });
});
