import { authedRoute, json, readJson } from "@/server/http/handler";
import { ruleSchema } from "@/server/validation/requirement";
import { createRule, listRules } from "@/server/services/requirement.service";

export const GET = authedRoute(async ({ actor }) => json({ rules: await listRules(actor) }));

export const POST = authedRoute(async ({ req, actor, meta }) => json({ rule: await createRule(actor, await readJson(req, ruleSchema), meta) }, 201));
