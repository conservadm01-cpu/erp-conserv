import { json, publicRoute, readJson } from "@/server/http/handler";
import { resetPasswordSchema } from "@/server/validation/auth";
import { resetPassword } from "@/server/services/auth.service";
import { hitRateLimit } from "@/server/http/rate-limit";
import { Errors } from "@/server/http/errors";

export const POST = publicRoute(async ({ req, meta }) => {
  if (hitRateLimit(`reset:${meta.ip ?? "local"}`, 20, 15 * 60_000)) throw Errors.tooMany();
  const { token, password } = await readJson(req, resetPasswordSchema);
  await resetPassword(token, password, meta);
  return json({ message: "Senha redefinida. Entre com a nova senha." });
});
