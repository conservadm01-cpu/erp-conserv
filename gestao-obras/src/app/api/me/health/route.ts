import { authedRoute, json, readMultipart } from "@/server/http/handler";
import { env } from "@/server/env";
import { healthCertificateSchema } from "@/server/validation/health";
import { uploadMyHealthCertificate } from "@/server/services/health.service";

export const POST = authedRoute(async ({ req, actor, meta }) => {
  const { fields, file } = await readMultipart(req, env().UPLOAD_MAX_MB * 1024 * 1024);
  return json({ certificate: await uploadMyHealthCertificate(actor, healthCertificateSchema.parse(fields), file, meta) }, 201);
});
