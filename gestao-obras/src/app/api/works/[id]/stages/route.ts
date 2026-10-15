import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { stageSchema } from "@/server/validation/work";
import { createStage } from "@/server/services/work.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) =>
  json({ stage: await createStage(actor, uuid.parse(params.id), await readJson(req, stageSchema), meta) }, 201),
);
