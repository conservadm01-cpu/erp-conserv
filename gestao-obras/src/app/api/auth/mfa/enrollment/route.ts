import { json, partialRoute } from "@/server/http/handler";
import { startMfaEnrollment } from "@/server/services/auth.service";
import { Errors } from "@/server/http/errors";

export const POST = partialRoute(async ({ session, state }) => {
  if (state !== "OK" && state !== "MFA_CADASTRO_OBRIGATORIO") throw Errors.forbidden("Conclua a verificação de acesso antes de continuar.");
  const data = await startMfaEnrollment(session);
  return json(data);
});
