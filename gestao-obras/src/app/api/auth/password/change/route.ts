import { json, partialRoute, readJson } from "@/server/http/handler";
import { changePasswordSchema } from "@/server/validation/auth";
import { changePassword } from "@/server/services/auth.service";
import { Errors } from "@/server/http/errors";

export const POST = partialRoute(async ({ req, session, state, meta }) => {
  // Com MFA pendente, quem só conhece a senha não pode trocá-la.
  if (state !== "OK" && state !== "TROCA_SENHA_OBRIGATORIA") throw Errors.forbidden("Conclua a verificação de acesso antes de continuar.");
  const { currentPassword, newPassword } = await readJson(req, changePasswordSchema);
  await changePassword(session, currentPassword, newPassword, meta);
  return json({ message: "Senha alterada." });
});
