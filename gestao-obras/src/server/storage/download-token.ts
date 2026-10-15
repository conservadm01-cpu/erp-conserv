import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";

export type DownloadPayload = { k: string; n: string; m: string; u: string };

function key() {
  // Chave derivada, separada da usada para cifrar segredos MFA.
  return createHmac("sha256", env().encryptionKey).update("download-token-v1").digest();
}

/** Token assinado (HMAC-SHA256), vinculado ao usuário e com expiração curta. */
export function signDownloadToken(payload: DownloadPayload, ttlSeconds: number, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(now / 1000) + ttlSeconds })).toString("base64url");
  const sig = createHmac("sha256", key()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyDownloadToken(token: string, now = Date.now()): (DownloadPayload & { exp: number }) | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || token.length > 2000) return null;
  const expected = createHmac("sha256", key()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof p.exp !== "number" || p.exp * 1000 < now) return null;
    if (typeof p.k !== "string" || typeof p.n !== "string" || typeof p.m !== "string" || typeof p.u !== "string") return null;
    return p;
  } catch {
    return null;
  }
}
