import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { updateRuleSchema } from "@/server/validation/requirement";
import { updateRule } from "@/server/services/requirement.service";

export const PATCH = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) =>
  json({ rule: await updateRule(actor, uuid.parse(params.id), await readJson(req, updateRuleSchema), meta) }),
);
