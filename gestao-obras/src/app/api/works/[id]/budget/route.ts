import { authedRoute, json } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { getWorkBudget } from "@/server/services/budget.service";

export const GET = authedRoute<{ id: string }>(async ({ actor, params }) => json(await getWorkBudget(actor, uuid.parse(params.id))));
