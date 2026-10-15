import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { checklistSchema } from "@/server/validation/phase3";
import { saveChecklist } from "@/server/services/safety.service";

export const PUT = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => json({ checklist: await saveChecklist(actor, uuid.parse(params.id), await readJson(req, checklistSchema), meta) }));
