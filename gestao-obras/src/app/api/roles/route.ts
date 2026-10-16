import { authedRoute, json, readJson } from "@/server/http/handler";
import { createRoleSchema } from "@/server/validation/role";
import { createRole, listRoles } from "@/server/services/role.service";

export const GET = authedRoute(async ({ actor }) => json(await listRoles(actor)));

export const POST = authedRoute(async ({ req, actor, meta }) => {
  const input = await readJson(req, createRoleSchema);
  return json({ role: await createRole(actor, input, meta) }, 201);
});
