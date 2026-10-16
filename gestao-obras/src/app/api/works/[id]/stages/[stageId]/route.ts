import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { stageSchema } from "@/server/validation/work";
import { updateStage } from "@/server/services/work.service";

export const PATCH = authedRoute<{ id: string; stageId: string }>(async ({ req, actor, params, meta }) =>
  json({ stage: await updateStage(actor, uuid.parse(params.id), uuid.parse(params.stageId), await readJson(req, stageSchema), meta) }),
);
