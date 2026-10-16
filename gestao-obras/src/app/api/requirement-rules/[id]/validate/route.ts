import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { validateRuleSchema } from "@/server/validation/requirement";
import { validateRule } from "@/server/services/requirement.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) =>
  json({ rule: await validateRule(actor, uuid.parse(params.id), await readJson(req, validateRuleSchema), meta) }),
);
