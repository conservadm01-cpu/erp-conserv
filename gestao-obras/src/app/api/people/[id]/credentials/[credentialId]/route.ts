import { z } from "zod";
import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { setCredentialStatus, verifyCredential } from "@/server/services/people.service";

type P = { id: string; credentialId: string };
const body = z.union([z.object({ verifySource: z.string().trim().min(3).max(300) }), z.object({ status: z.enum(["ATIVO", "INATIVO"]) })]);

/** Registra conferência em fonte oficial ou altera a situação da qualificação. */
export const PATCH = authedRoute<P>(async ({ req, actor, params, meta }) => {
  const input = await readJson(req, body);
  if ("verifySource" in input) return json({ credential: await verifyCredential(actor, uuid.parse(params.id), uuid.parse(params.credentialId), input.verifySource, meta) });
  await setCredentialStatus(actor, uuid.parse(params.id), uuid.parse(params.credentialId), input.status, meta);
  return json({ ok: true });
});
