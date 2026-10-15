import { authedRoute, json } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { listWorkRequirements } from "@/server/services/requirement.service";

export const GET = authedRoute<{ id: string }>(async ({ actor, params }) => json({ requirements: await listWorkRequirements(actor, uuid.parse(params.id)) }));
