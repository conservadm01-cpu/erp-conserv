import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { measurementSchema } from "@/server/validation/phase4";
import { saveMeasurement } from "@/server/services/budget.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => json({ measurement: await saveMeasurement(actor, uuid.parse(params.id), null, await readJson(req, measurementSchema), meta) }, 201));
