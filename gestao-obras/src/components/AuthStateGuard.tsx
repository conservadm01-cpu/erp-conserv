import { redirect } from "next/navigation";
import { currentSession, STATE_ROUTES } from "@/server/auth/page-context";
import type { AuthState } from "@/server/auth/actor";

/** Garante que a página de verificação corresponda ao estado atual da sessão. */
export async function requireState(expected: AuthState[]) {
  const current = await currentSession();
  if (!current) redirect("/login");
  if (!expected.includes(current.state)) redirect(current.state === "OK" ? "/" : STATE_ROUTES[current.state]);
  return current;
}
