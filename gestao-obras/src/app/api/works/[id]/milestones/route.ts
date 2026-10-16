import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { milestoneSchema } from "@/server/validation/phase4";
import { saveMilestone } from "@/server/services/schedule.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => json({ milestone: await saveMilestone(actor, uuid.parse(params.id), null, await readJson(req, milestoneSchema), meta) }, 201));
