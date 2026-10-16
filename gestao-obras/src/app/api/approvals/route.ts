import { authedRoute, json } from "@/server/http/handler";
import { listInbox } from "@/server/services/approval.service";

export const GET = authedRoute(async ({ actor }) => json(await listInbox(actor)));
