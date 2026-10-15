import { json, partialRoute, readJson } from "@/server/http/handler";
import { mfaCodeSchema } from "@/server/validation/auth";
import { confirmMfaEnrollment } from "@/server/services/auth.service";
import { Errors } from "@/server/http/errors";

export const POST = partialRoute(async ({ req, session, state, meta }) => {
  if (state !== "OK" && state !== "MFA_CADASTRO_OBRIGATORIO") throw Errors.forbidden("Conclua a verificação de acesso antes de continuar.");
  const { code } = await readJson(req, mfaCodeSchema);
  const result = await confirmMfaEnrollment(session, code, meta);
  return json(result);
});
