import { authedRoute, json } from "@/server/http/handler";
import { assertCanAnywhere } from "@/server/authz/authorize";
import { listPolicies } from "@/server/services/approval.service";

export const GET = authedRoute(async ({ actor }) => {
  assertCanAnywhere(actor, "approval.decide");
  return json({ policies: await listPolicies() });
});
