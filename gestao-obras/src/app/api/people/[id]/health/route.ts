import { authedRoute, json, readMultipartOptional } from "@/server/http/handler";
import { env } from "@/server/env";
import { uuid } from "@/server/validation/common";
import { healthCertificateSchema } from "@/server/validation/health";
import { addHealthCertificate, listHealthCertificates } from "@/server/services/health.service";
import { Errors } from "@/server/http/errors";

type P = { id: string };
export const GET = authedRoute<P>(async ({ actor, params }) => {
  const list = await listHealthCertificates(actor, uuid.parse(params.id));
  if (list === null) throw Errors.forbidden("Você não pode consultar dados de saúde.");
  return json({ certificates: list });
});
export const POST = authedRoute<P>(async ({ req, actor, params, meta }) => {
  const { fields, file } = await readMultipartOptional(req, env().UPLOAD_MAX_MB * 1024 * 1024);
  const input = healthCertificateSchema.parse(fields);
  return json({ certificate: await addHealthCertificate(actor, uuid.parse(params.id), { ...input, checked: fields.checked === "true" }, file, meta) }, 201);
});
