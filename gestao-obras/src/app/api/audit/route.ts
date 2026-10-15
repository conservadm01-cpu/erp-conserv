import { authedRoute, json, readQuery } from "@/server/http/handler";
import { auditQuerySchema, listAuditEvents } from "@/server/services/audit.service";

export const GET = authedRoute(async ({ req, actor, meta }) => json(await listAuditEvents(actor, readQuery(req, auditQuerySchema), meta)));
