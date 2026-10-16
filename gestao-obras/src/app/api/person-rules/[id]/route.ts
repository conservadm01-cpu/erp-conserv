import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { personRuleUpdateSchema } from "@/server/validation/health";
import { updatePersonRule } from "@/server/services/health.service";

export const PATCH = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => {
  return json({ rule: await updatePersonRule(actor, uuid.parse(params.id), await readJson(req, personRuleUpdateSchema), meta) });
});
