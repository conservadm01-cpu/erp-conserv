import { authedRoute, json } from "@/server/http/handler";
import { listPersonRules } from "@/server/services/health.service";

export const GET = authedRoute(async ({ actor }) => json({ rules: await listPersonRules(actor) }));
