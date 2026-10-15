import { z } from "zod";
import { authedRoute, json, readJson } from "@/server/http/handler";
import { policySchema } from "@/server/validation/approval";
import { updatePolicy } from "@/server/services/approval.service";

export const PATCH = authedRoute<{ kind: string }>(async ({ req, actor, params, meta }) => {
  const kind = z.enum(["SOLICITACAO_OBRA", "ENCERRAMENTO_OBRA"]).parse(params.kind);
  return json({ policy: await updatePolicy(actor, kind, await readJson(req, policySchema), meta) });
});
