import { z } from "zod";
import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { setContractStatus } from "@/server/services/company.service";

export const PATCH = authedRoute<{ id: string; contractId: string }>(async ({ req, actor, params, meta }) => {
  const { status } = await readJson(req, z.object({ status: z.enum(["RASCUNHO", "VIGENTE", "ENCERRADO", "CANCELADO"]) }));
  return json({ contract: await setContractStatus(actor, uuid.parse(params.id), uuid.parse(params.contractId), status, meta) });
});
