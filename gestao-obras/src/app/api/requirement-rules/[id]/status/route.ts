import { z } from "zod";
import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { setRuleActive } from "@/server/services/requirement.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => {
  const { active } = await readJson(req, z.object({ active: z.boolean() }));
  return json({ rule: await setRuleActive(actor, uuid.parse(params.id), active, meta) });
});
