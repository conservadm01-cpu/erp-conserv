import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { stageScheduleSchema } from "@/server/validation/phase4";
import { updateStageSchedule } from "@/server/services/schedule.service";

export const PATCH = authedRoute<{ id: string; stageId: string }>(async ({ req, actor, params, meta }) =>
  json({ stage: await updateStageSchedule(actor, uuid.parse(params.id), uuid.parse(params.stageId), await readJson(req, stageScheduleSchema), meta) }),
);
