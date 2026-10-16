import { authedRoute, json } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { cancelCost } from "@/server/services/budget.service";

export const DELETE = authedRoute<{ id: string; costId: string }>(async ({ actor, params, meta }) => {
  await cancelCost(actor, uuid.parse(params.id), uuid.parse(params.costId), meta);
  return json({ ok: true });
});
