import { authedRoute, json, readJson } from "@/server/http/handler";
import { updateRoleSchema } from "@/server/validation/role";
import { uuid } from "@/server/validation/common";
import { updateRole } from "@/server/services/role.service";

export const PATCH = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => {
  const input = await readJson(req, updateRoleSchema);
  return json({ role: await updateRole(actor, uuid.parse(params.id), input, meta) });
});
