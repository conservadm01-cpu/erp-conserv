import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { submitSchema } from "@/server/validation/phase4";
import { submitMeasurement } from "@/server/services/budget.service";

export const POST = authedRoute<{ id: string; measurementId: string }>(async ({ req, actor, params, meta }) => {
  const { note } = await readJson(req, submitSchema);
  return json(await submitMeasurement(actor, uuid.parse(params.id), uuid.parse(params.measurementId), note, meta));
});
