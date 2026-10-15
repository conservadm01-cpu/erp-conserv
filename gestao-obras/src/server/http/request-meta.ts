import { randomUUID } from "node:crypto";
import { env } from "../env";

export type RequestMeta = {
  correlationId: string;
  ip: string | null;
  userAgent: string | null;
};

const CORRELATION_RE = /^[A-Za-z0-9-]{8,64}$/;

export function metaFromHeaders(headers: Headers): RequestMeta {
  const incoming = headers.get("x-correlation-id");
  const correlationId = incoming && CORRELATION_RE.test(incoming) ? incoming : randomUUID();
  let ip: string | null = null;
  if (env().TRUST_PROXY) {
    ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip");
  }
  return {
    correlationId,
    ip: ip ? ip.slice(0, 64) : null,
    userAgent: headers.get("user-agent")?.slice(0, 400) ?? null,
  };
}

/** Metadados para operações internas (seed, scripts, testes). */
export function systemMeta(label = "sistema"): RequestMeta {
  return { correlationId: randomUUID(), ip: null, userAgent: label };
}
