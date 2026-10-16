import { authedRoute, json } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { resetUserMfa } from "@/server/services/user.service";

export const POST = authedRoute<{ id: string }>(async ({ actor, params, meta }) => {
  await resetUserMfa(actor, uuid.parse(params.id), meta);
  return json({ ok: true });
});
