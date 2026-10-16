import { z } from "zod";
import { authedRoute, json, readJson } from "@/server/http/handler";
import { tiersSchema } from "@/server/validation/phase4";
import { replaceTiers } from "@/server/services/approval.service";

const KINDS = ["SOLICITACAO_OBRA", "ENCERRAMENTO_OBRA", "MUDANCA_ESCOPO", "ORCAMENTO", "MEDICAO", "DESPESA"] as const;
export const PUT = authedRoute<{ kind: string }>(async ({ req, actor, params, meta }) => {
  const { tiers } = await readJson(req, tiersSchema);
  await replaceTiers(actor, z.enum(KINDS).parse(params.kind), tiers, meta);
  return json({ ok: true });
});
