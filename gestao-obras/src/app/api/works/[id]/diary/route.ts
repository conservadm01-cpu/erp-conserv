import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { diarySchema } from "@/server/validation/phase4";
import { addDiaryEntry, listDiary } from "@/server/services/schedule.service";

type P = { id: string };
export const GET = authedRoute<P>(async ({ actor, params }) => json({ entries: await listDiary(actor, uuid.parse(params.id)) }));
export const POST = authedRoute<P>(async ({ req, actor, params, meta }) => json({ entry: await addDiaryEntry(actor, uuid.parse(params.id), await readJson(req, diarySchema), meta) }, 201));
