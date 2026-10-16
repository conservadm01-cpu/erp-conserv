import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { linkUserSchema } from "@/server/validation/health";
import { linkPersonUser } from "@/server/services/health.service";

export const PUT = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => {
  const { email } = await readJson(req, linkUserSchema);
  await linkPersonUser(actor, uuid.parse(params.id), email, meta);
  return json({ ok: true });
});
