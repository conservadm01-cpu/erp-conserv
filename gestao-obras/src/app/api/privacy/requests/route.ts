import { authedRoute, json, readJson } from "@/server/http/handler";
import { privacyRequestSchema } from "@/server/validation/phase4";
import { listPrivacyRequests, openPrivacyRequest } from "@/server/services/privacy.service";

export const GET = authedRoute(async ({ actor }) => json({ requests: await listPrivacyRequests(actor) }));
export const POST = authedRoute(async ({ req, actor, meta }) => json({ request: await openPrivacyRequest(actor, await readJson(req, privacyRequestSchema), meta) }, 201));
