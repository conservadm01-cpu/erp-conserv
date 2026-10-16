import { authedRoute, json } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { removeUserScope } from "@/server/services/user.service";

export const DELETE = authedRoute<{ id: string; scopeId: string }>(async ({ actor, params, meta }) => {
  await removeUserScope(actor, uuid.parse(params.id), uuid.parse(params.scopeId), meta);
  return json({ ok: true });
});
