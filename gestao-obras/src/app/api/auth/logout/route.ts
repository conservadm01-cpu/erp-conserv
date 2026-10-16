import { NextResponse } from "next/server";
import { partialRoute } from "@/server/http/handler";
import { logout } from "@/server/services/auth.service";
import { sessionCookieName } from "@/server/auth/session";

export const POST = partialRoute(async ({ session, meta }) => {
  await logout(session, meta);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(sessionCookieName());
  return res;
});
