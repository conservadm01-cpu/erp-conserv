import { authedRoute, json } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { getApproval } from "@/server/services/approval.service";

export const GET = authedRoute<{ id: string }>(async ({ actor, params }) => json({ approval: await getApproval(actor, uuid.parse(params.id)) }));
