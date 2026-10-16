import { authedRoute, json } from "@/server/http/handler";
import { assertCanAnywhere } from "@/server/authz/authorize";
import { listTiers } from "@/server/services/approval.service";

export const GET = authedRoute(async ({ actor }) => {
  assertCanAnywhere(actor, "approval.decide");
  return json({ tiers: await listTiers() });
});
