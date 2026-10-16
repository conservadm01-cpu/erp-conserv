import { authedRoute, json, readMultipart } from "@/server/http/handler";
import { env } from "@/server/env";
import { uuid } from "@/server/validation/common";
import { documentMetaSchema } from "@/server/validation/document";
import { uploadOwnedDocument } from "@/server/services/document.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => {
  const { fields, file } = await readMultipart(req, env().UPLOAD_MAX_MB * 1024 * 1024);
  return json({ document: await uploadOwnedDocument(actor, { kind: "person", id: uuid.parse(params.id) }, documentMetaSchema.parse(fields), file, meta) }, 201);
});
