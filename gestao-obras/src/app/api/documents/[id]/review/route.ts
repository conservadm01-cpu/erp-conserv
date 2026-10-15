import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { reviewSchema } from "@/server/validation/document";
import { reviewDocument } from "@/server/services/document.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) =>
  json({ document: await reviewDocument(actor, uuid.parse(params.id), await readJson(req, reviewSchema), meta) }),
);
