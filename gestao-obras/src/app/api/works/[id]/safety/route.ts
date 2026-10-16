import { authedRoute, json } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { workSafetySummary } from "@/server/services/safety.service";

export const GET = authedRoute<{ id: string }>(async ({ actor, params }) => json(await workSafetySummary(actor, uuid.parse(params.id))));
