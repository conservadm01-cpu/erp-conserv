import { authedRoute, json } from "@/server/http/handler";
import { listOrgUnitTypes } from "@/server/services/org-unit.service";

export const GET = authedRoute(async () => json({ types: await listOrgUnitTypes() }));
