import { authedRoute, json, readJson } from "@/server/http/handler";
import { riskSchema } from "@/server/validation/phase3";
import { createRisk } from "@/server/services/safety.service";

export const POST = authedRoute(async ({ req, actor, meta }) => json({ risk: await createRisk(actor, await readJson(req, riskSchema), meta) }, 201));
