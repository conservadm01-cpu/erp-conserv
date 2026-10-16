import { authedRoute, json, readMultipart } from "@/server/http/handler";
import { env } from "@/server/env";
import { uuid } from "@/server/validation/common";
import { documentMetaSchema } from "@/server/validation/document";
import { listWorkDocuments, uploadDocument } from "@/server/services/document.service";

type P = { id: string };

export const GET = authedRoute<P>(async ({ actor, params }) => json({ documents: await listWorkDocuments(actor, uuid.parse(params.id)) }));

export const POST = authedRoute<P>(async ({ req, actor, params, meta }) => {
  const { fields, file } = await readMultipart(req, env().UPLOAD_MAX_MB * 1024 * 1024);
  const doc = await uploadDocument(actor, uuid.parse(params.id), documentMetaSchema.parse(fields), file, meta);
  return json({ document: doc }, 201);
});
