import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { budgetLineSchema } from "@/server/validation/phase4";
import { deleteBudgetLine, saveBudgetLine } from "@/server/services/budget.service";

type P = { id: string; budgetId: string; lineId: string };
export const PUT = authedRoute<P>(async ({ req, actor, params, meta }) => {
  await saveBudgetLine(actor, uuid.parse(params.id), uuid.parse(params.budgetId), uuid.parse(params.lineId), await readJson(req, budgetLineSchema), meta);
  return json({ ok: true });
});
export const DELETE = authedRoute<P>(async ({ actor, params, meta }) => {
  await deleteBudgetLine(actor, uuid.parse(params.id), uuid.parse(params.budgetId), uuid.parse(params.lineId), meta);
  return json({ ok: true });
});
