import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { scopeChangeSchema } from "@/server/validation/phase4";
import { listScopeChanges, requestScopeChange } from "@/server/services/schedule.service";

type P = { id: string };
export const GET = authedRoute<P>(async ({ actor, params }) => json({ changes: await listScopeChanges(actor, uuid.parse(params.id)) }));
export const POST = authedRoute<P>(async ({ req, actor, params, meta }) => json({ change: await requestScopeChange(actor, uuid.parse(params.id), await readJson(req, scopeChangeSchema), meta) }, 201));
