import { authedRoute, json, readJson, readQuery } from "@/server/http/handler";
import { agendaEventSchema, agendaQuery } from "@/server/validation/agenda";
import { createAgendaEvent, listAgenda, monthRange } from "@/server/services/agenda.service";

export const GET = authedRoute(async ({ req, actor }) => {
  const q = readQuery(req, agendaQuery);
  const { from, to, mes } = monthRange(q.mes);
  return json({ mes, items: await listAgenda(actor, { unitId: q.unitId, from, to }) });
});
export const POST = authedRoute(async ({ req, actor, meta }) => json({ event: await createAgendaEvent(actor, await readJson(req, agendaEventSchema), meta) }, 201));
