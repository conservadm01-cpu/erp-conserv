import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { decisionSchema } from "@/server/validation/approval";
import { decideApproval } from "@/server/services/approval.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) =>
  json(await decideApproval(actor, uuid.parse(params.id), await readJson(req, decisionSchema), meta)),
);
