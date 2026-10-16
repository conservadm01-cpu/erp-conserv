import { authedRoute, json } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { requestDownload } from "@/server/services/document.service";

export const POST = authedRoute<{ id: string; versionId: string }>(async ({ actor, params, meta }) =>
  json(await requestDownload(actor, uuid.parse(params.id), uuid.parse(params.versionId), meta)),
);
