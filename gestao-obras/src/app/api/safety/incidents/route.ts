import { authedRoute, json, readJson } from "@/server/http/handler";
import { incidentSchema } from "@/server/validation/phase3";
import { createIncident } from "@/server/services/safety.service";

export const POST = authedRoute(async ({ req, actor, meta }) => json({ incident: await createIncident(actor, await readJson(req, incidentSchema), meta) }, 201));
