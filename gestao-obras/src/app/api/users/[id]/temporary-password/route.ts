import { authedRoute, json, readJson } from "@/server/http/handler";
import { temporaryPasswordSchema } from "@/server/validation/user";
import { uuid } from "@/server/validation/common";
import { setTemporaryPassword } from "@/server/services/user.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => {
  const { temporaryPassword } = await readJson(req, temporaryPasswordSchema);
  await setTemporaryPassword(actor, uuid.parse(params.id), temporaryPassword, meta);
  return json({ ok: true });
});
