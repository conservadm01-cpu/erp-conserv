import { authedRoute, json, readJson } from "@/server/http/handler";
import { stockMovementSchema } from "@/server/validation/phase3";
import { addMovement, listMovements, stockBalances } from "@/server/services/epi.service";

export const GET = authedRoute(async ({ actor }) => json({ balances: await stockBalances(actor), movements: await listMovements(actor) }));
export const POST = authedRoute(async ({ req, actor, meta }) => json(await addMovement(actor, await readJson(req, stockMovementSchema), meta), 201));
