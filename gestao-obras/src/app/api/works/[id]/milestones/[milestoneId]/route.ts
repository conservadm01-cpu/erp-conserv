import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { milestoneSchema } from "@/server/validation/phase4";
import { saveMilestone } from "@/server/services/schedule.service";

export const PUT = authedRoute<{ id: string; milestoneId: string }>(async ({ req, actor, params, meta }) =>
  json({ milestone: await saveMilestone(actor, uuid.parse(params.id), uuid.parse(params.milestoneId), await readJson(req, milestoneSchema), meta) }),
);
