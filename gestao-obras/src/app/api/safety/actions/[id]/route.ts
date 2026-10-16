import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { actionStepSchema } from "@/server/validation/phase3";
import { advanceAction, getAction } from "@/server/services/safety.service";

type P = { id: string };
export const GET = authedRoute<P>(async ({ actor, params }) => json({ action: await getAction(actor, uuid.parse(params.id)) }));
export const POST = authedRoute<P>(async ({ req, actor, params, meta }) => json({ action: await advanceAction(actor, uuid.parse(params.id), await readJson(req, actionStepSchema), meta) }));
