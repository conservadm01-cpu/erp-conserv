import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { costEntrySchema } from "@/server/validation/phase4";
import { addCost } from "@/server/services/budget.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => json({ cost: await addCost(actor, uuid.parse(params.id), await readJson(req, costEntrySchema), meta) }, 201));
