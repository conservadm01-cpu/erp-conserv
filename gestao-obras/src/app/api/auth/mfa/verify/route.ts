import { json, partialRoute, readJson } from "@/server/http/handler";
import { mfaCodeSchema } from "@/server/validation/auth";
import { verifyMfa } from "@/server/services/auth.service";
import { authStateFor } from "@/server/auth/actor";
import { loadSession } from "@/server/auth/session";
import { sessionCookieName } from "@/server/auth/session";

export const POST = partialRoute(async ({ req, session, meta }) => {
  const { code } = await readJson(req, mfaCodeSchema);
  await verifyMfa(session, code, meta);
  const refreshed = await loadSession(req.cookies.get(sessionCookieName())?.value);
  return json({ state: refreshed ? await authStateFor(refreshed) : "OK" });
});
