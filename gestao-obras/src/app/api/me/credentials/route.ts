import { authedRoute, json, readMultipart } from "@/server/http/handler";
import { env } from "@/server/env";
import { selfCredentialSchema } from "@/server/validation/health";
import { uploadMyCredential } from "@/server/services/health.service";

export const POST = authedRoute(async ({ req, actor, meta }) => {
  const { fields, file } = await readMultipart(req, env().UPLOAD_MAX_MB * 1024 * 1024);
  return json({ credential: await uploadMyCredential(actor, selfCredentialSchema.parse(fields), file, meta) }, 201);
});
