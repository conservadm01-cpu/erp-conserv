import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { updateRiskSchema } from "@/server/validation/phase3";
import { updateRisk } from "@/server/services/safety.service";

export const PATCH = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => json({ risk: await updateRisk(actor, uuid.parse(params.id), await readJson(req, updateRiskSchema), meta) }));
