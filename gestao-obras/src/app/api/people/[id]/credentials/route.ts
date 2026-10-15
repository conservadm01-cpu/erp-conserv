import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { credentialSchema } from "@/server/validation/phase3";
import { addCredential } from "@/server/services/people.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => json({ credential: await addCredential(actor, uuid.parse(params.id), await readJson(req, credentialSchema), meta) }, 201));
