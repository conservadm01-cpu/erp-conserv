import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { budgetLineSchema } from "@/server/validation/phase4";
import { saveBudgetLine } from "@/server/services/budget.service";

export const POST = authedRoute<{ id: string; budgetId: string }>(async ({ req, actor, params, meta }) => {
  await saveBudgetLine(actor, uuid.parse(params.id), uuid.parse(params.budgetId), null, await readJson(req, budgetLineSchema), meta);
  return json({ ok: true }, 201);
});
