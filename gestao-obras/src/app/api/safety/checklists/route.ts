import { authedRoute, json, readJson } from "@/server/http/handler";
import { checklistSchema } from "@/server/validation/phase3";
import { listChecklists, saveChecklist } from "@/server/services/safety.service";

export const GET = authedRoute(async ({ actor }) => json({ checklists: await listChecklists(actor) }));
export const POST = authedRoute(async ({ req, actor, meta }) => json({ checklist: await saveChecklist(actor, null, await readJson(req, checklistSchema), meta) }, 201));
