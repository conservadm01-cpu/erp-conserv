import { authedRoute, json, readJson } from "@/server/http/handler";
import { userStatusSchema } from "@/server/validation/user";
import { uuid } from "@/server/validation/common";
import { setUserStatus } from "@/server/services/user.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => {
  const { status, reason } = await readJson(req, userStatusSchema);
  await setUserStatus(actor, uuid.parse(params.id), status, reason, meta);
  return json({ ok: true });
});
