import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { baselineSchema } from "@/server/validation/phase4";
import { createBaseline } from "@/server/services/schedule.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => {
  const { reason } = await readJson(req, baselineSchema);
  return json({ baseline: await createBaseline(actor, uuid.parse(params.id), reason, meta) }, 201);
});
