import { z } from "zod";
import { authedRoute, json, readJson, readQuery } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { actionSchema } from "@/server/validation/phase3";
import { createAction, listActions } from "@/server/services/safety.service";

const q = z.object({ workId: uuid.optional(), status: z.enum(["ABERTA", "EM_ANDAMENTO", "AGUARDANDO_VALIDACAO", "ENCERRADA", "CANCELADA"]).optional(), overdue: z.enum(["1"]).optional() });
export const GET = authedRoute(async ({ req, actor }) => {
  const { overdue, ...rest } = readQuery(req, q);
  return json({ actions: await listActions(actor, { ...rest, overdue: Boolean(overdue) }) });
});
export const POST = authedRoute(async ({ req, actor, meta }) => json({ action: await createAction(actor, await readJson(req, actionSchema), meta) }, 201));
