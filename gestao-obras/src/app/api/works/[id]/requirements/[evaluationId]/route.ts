import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { evaluationSchema } from "@/server/validation/requirement";
import { setEvaluation } from "@/server/services/requirement.service";

export const PATCH = authedRoute<{ id: string; evaluationId: string }>(async ({ req, actor, params, meta }) =>
  json({ evaluation: await setEvaluation(actor, uuid.parse(params.id), uuid.parse(params.evaluationId), await readJson(req, evaluationSchema), meta) }),
);
