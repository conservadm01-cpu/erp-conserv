import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { privacyCloseSchema } from "@/server/validation/phase4";
import { closePrivacyRequest } from "@/server/services/privacy.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => json({ request: await closePrivacyRequest(actor, uuid.parse(params.id), await readJson(req, privacyCloseSchema), meta) }));
