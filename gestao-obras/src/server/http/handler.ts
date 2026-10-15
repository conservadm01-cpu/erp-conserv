import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodType, type ZodTypeDef } from "zod";
import "../validation/zod-pt";
import { env } from "../env";
import { AppError, Errors } from "./errors";
import { metaFromHeaders, type RequestMeta } from "./request-meta";
import { loadSession, sessionCookieName, type LoadedSession } from "../auth/session";
import { authStateFor, buildActor, type AuthState } from "../auth/actor";
import type { Actor } from "../authz/authorize";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const MAX_BODY_BYTES = 1_000_000;

type Base<P> = { req: NextRequest; params: P; meta: RequestMeta };
type PublicCtx<P> = Base<P>;
type PartialCtx<P> = Base<P> & { session: LoadedSession; state: AuthState };
type AuthedCtx<P> = Base<P> & { session: LoadedSession; actor: Actor };

type RouteContext = { params: Promise<Record<string, string | string[]>> };

/** Rejeita mutações vindas de outra origem (proteção CSRF complementar ao SameSite). */
export function checkOrigin(req: Request): boolean {
  if (!MUTATING.has(req.method)) return true;
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  const allowed = new Set([new URL(env().APP_URL).origin]);
  const host = req.headers.get("host");
  if (host) {
    const proto = env().TRUST_PROXY ? req.headers.get("x-forwarded-proto") ?? "http" : new URL(req.url).protocol.replace(":", "");
    allowed.add(`${proto}://${host}`);
  }
  return allowed.has(origin);
}

export function errorResponse(err: unknown, correlationId: string) {
  let status = 500;
  let body: Record<string, unknown> = {
    error: { code: "ERRO_INTERNO", message: "Erro interno. Informe o código de correlação ao suporte.", correlationId },
  };
  if (err instanceof AppError) {
    status = err.status;
    body = { error: { code: err.code, message: err.message, details: err.details, correlationId } };
  } else if (err instanceof ZodError) {
    status = 422;
    body = {
      error: {
        code: "DADOS_INVALIDOS",
        message: "Verifique os campos destacados.",
        details: err.flatten().fieldErrors,
        correlationId,
      },
    };
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    status = 409;
    body = { error: { code: "CONFLITO", message: "Já existe um registro com estes dados.", correlationId } };
  } else {
    console.error(`[erro] correlationId=${correlationId}`, err);
  }
  const res = NextResponse.json(body, { status });
  res.headers.set("x-correlation-id", correlationId);
  return res;
}

export async function readJson<T>(req: NextRequest, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) throw Errors.invalid("Requisição muito grande.");
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw Errors.invalid("Corpo da requisição inválido (JSON esperado).");
  }
  return schema.parse(raw);
}

export function readQuery<T>(req: NextRequest, schema: ZodType<T, ZodTypeDef, unknown>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
}

async function resolveParams<P>(ctx: RouteContext | undefined): Promise<P> {
  return ((ctx?.params ? await ctx.params : {}) ?? {}) as P;
}

function wrap<C>(build: (req: NextRequest, meta: RequestMeta, rc: RouteContext) => Promise<C>, fn: (c: C) => Promise<Response>) {
  return async (req: NextRequest, rc: RouteContext): Promise<Response> => {
    let meta: RequestMeta = { correlationId: randomUUID(), ip: null, userAgent: null };
    try {
      meta = metaFromHeaders(req.headers);
      if (!checkOrigin(req)) throw Errors.forbidden("Origem da requisição não permitida.");
      const res = await fn(await build(req, meta, rc));
      res.headers.set("x-correlation-id", meta.correlationId);
      res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (err) {
      return errorResponse(err, meta.correlationId);
    }
  };
}

async function requireSession(req: NextRequest) {
  const session = await loadSession(req.cookies.get(sessionCookieName())?.value);
  if (!session) throw Errors.unauthenticated();
  return session;
}

/** Rota pública (login, recuperação de senha). */
export function publicRoute<P = Record<string, never>>(fn: (c: PublicCtx<P>) => Promise<Response>) {
  return wrap(async (req, meta, rc) => ({ req, meta, params: await resolveParams<P>(rc) }), fn);
}

/** Rota que aceita sessão ainda incompleta (MFA pendente, troca de senha). */
export function partialRoute<P = Record<string, never>>(fn: (c: PartialCtx<P>) => Promise<Response>) {
  return wrap(async (req, meta, rc) => {
    const session = await requireSession(req);
    return { req, meta, params: await resolveParams<P>(rc), session, state: await authStateFor(session) };
  }, fn);
}

/** Rota autenticada: exige sessão completa. A autorização fica nos serviços. */
export function authedRoute<P = Record<string, never>>(fn: (c: AuthedCtx<P>) => Promise<Response>) {
  return wrap(async (req, meta, rc) => {
    const session = await requireSession(req);
    const state = await authStateFor(session);
    if (state !== "OK") throw Errors.stateRequired(state, "Conclua a verificação de acesso antes de continuar.");
    const actor = await buildActor(session.user, session.id);
    return { req, meta, params: await resolveParams<P>(rc), session, actor };
  }, fn);
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
