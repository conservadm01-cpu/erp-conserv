import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { loadSession, sessionCookieName } from "./session";
import { authStateFor, buildActor } from "./actor";
import { metaFromHeaders } from "../http/request-meta";

export const STATE_ROUTES = {
  MFA_PENDENTE: "/mfa",
  MFA_CADASTRO_OBRIGATORIO: "/mfa/cadastro",
  TROCA_SENHA_OBRIGATORIA: "/trocar-senha",
} as const;

export const currentSession = cache(async () => {
  const store = await cookies();
  const session = await loadSession(store.get(sessionCookieName())?.value);
  if (!session) return null;
  return { session, state: await authStateFor(session) };
});

/** Para páginas protegidas: devolve o ator ou redireciona. */
export const requirePageActor = cache(async () => {
  const current = await currentSession();
  if (!current) redirect("/login");
  if (current.state !== "OK") redirect(STATE_ROUTES[current.state]);
  return buildActor(current.session.user, current.session.id);
});

export async function pageMeta() {
  return metaFromHeaders(await headers());
}
