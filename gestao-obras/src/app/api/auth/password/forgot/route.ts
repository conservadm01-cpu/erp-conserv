import { json, publicRoute, readJson } from "@/server/http/handler";
import { forgotPasswordSchema } from "@/server/validation/auth";
import { requestPasswordReset } from "@/server/services/auth.service";
import { hitRateLimit } from "@/server/http/rate-limit";
import { Errors } from "@/server/http/errors";

export const POST = publicRoute(async ({ req, meta }) => {
  const { email } = await readJson(req, forgotPasswordSchema);
  if (hitRateLimit(`forgot:${meta.ip ?? "local"}`, 10, 15 * 60_000) || hitRateLimit(`forgot:${email}`, 3, 15 * 60_000)) {
    throw Errors.tooMany();
  }
  await requestPasswordReset(email, meta);
  return json({ message: "Se o e-mail estiver cadastrado e ativo, você receberá as instruções em instantes." });
});
