import { authedRoute, json } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { listWorkTeam } from "@/server/services/people.service";

export const GET = authedRoute<{ id: string }>(async ({ actor, params }) => json({ team: await listWorkTeam(actor, uuid.parse(params.id)) }));
