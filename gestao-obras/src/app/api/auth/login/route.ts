import { NextResponse } from "next/server";
import { publicRoute, readJson } from "@/server/http/handler";
import { loginSchema } from "@/server/validation/auth";
import { login } from "@/server/services/auth.service";
import { sessionCookieName, sessionCookieOptions } from "@/server/auth/session";
import { hitRateLimit } from "@/server/http/rate-limit";
import { Errors } from "@/server/http/errors";

export const POST = publicRoute(async ({ req, meta }) => {
  if (hitRateLimit(`login:${meta.ip ?? "local"}`, 60, 60_000)) throw Errors.tooMany();
  const input = await readJson(req, loginSchema);
  const result = await login(input, meta);
  const res = NextResponse.json({ state: result.state });
  res.cookies.set(sessionCookieName(), result.token, sessionCookieOptions(result.expiresAt));
  return res;
});
