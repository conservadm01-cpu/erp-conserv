import { authedRoute, json } from "@/server/http/handler";
import { assertCanAnywhere } from "@/server/authz/authorize";
import { listPermissionCatalog } from "@/server/services/role.service";

export const GET = authedRoute(async ({ actor }) => {
  assertCanAnywhere(actor, "role.read");
  return json({ permissions: listPermissionCatalog() });
});
