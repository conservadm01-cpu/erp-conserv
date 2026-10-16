import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { submitSchema } from "@/server/validation/phase4";
import { submitBudget } from "@/server/services/budget.service";

export const POST = authedRoute<{ id: string; budgetId: string }>(async ({ req, actor, params, meta }) => {
  const { note } = await readJson(req, submitSchema);
  await submitBudget(actor, uuid.parse(params.id), uuid.parse(params.budgetId), note, meta);
  return json({ ok: true });
});
