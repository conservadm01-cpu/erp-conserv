import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { agendaStatusSchema } from "@/server/validation/agenda";
import { setAgendaEventStatus } from "@/server/services/agenda.service";

export const PATCH = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => {
  return json({ event: await setAgendaEventStatus(actor, uuid.parse(params.id), await readJson(req, agendaStatusSchema), meta) });
});
