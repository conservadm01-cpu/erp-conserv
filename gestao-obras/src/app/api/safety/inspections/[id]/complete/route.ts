import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { completeInspectionSchema } from "@/server/validation/phase3";
import { completeInspection } from "@/server/services/safety.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => json(await completeInspection(actor, uuid.parse(params.id), await readJson(req, completeInspectionSchema), meta)));
