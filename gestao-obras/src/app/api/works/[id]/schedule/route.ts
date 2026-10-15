import { authedRoute, json } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { getSchedule } from "@/server/services/schedule.service";

export const GET = authedRoute<{ id: string }>(async ({ actor, params }) => json(await getSchedule(actor, uuid.parse(params.id))));
