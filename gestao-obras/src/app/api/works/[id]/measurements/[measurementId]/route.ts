import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { measurementSchema } from "@/server/validation/phase4";
import { saveMeasurement } from "@/server/services/budget.service";

export const PUT = authedRoute<{ id: string; measurementId: string }>(async ({ req, actor, params, meta }) =>
  json({ measurement: await saveMeasurement(actor, uuid.parse(params.id), uuid.parse(params.measurementId), await readJson(req, measurementSchema), meta) }),
);
