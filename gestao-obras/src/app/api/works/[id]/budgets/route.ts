import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { budgetSchema } from "@/server/validation/phase4";
import { createBudget } from "@/server/services/budget.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => json({ budget: await createBudget(actor, uuid.parse(params.id), await readJson(req, budgetSchema), meta) }, 201));
