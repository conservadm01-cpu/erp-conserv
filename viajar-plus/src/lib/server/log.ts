// Log estruturado que nunca grava segredos: chaves sensíveis, tokens JWT,
// cabeçalhos Bearer, e-mails e cadeias longas com aparência de credencial são redigidos.

const SENSITIVE_KEY = /(pass(word)?|senha|secret|token|api[-_]?key|apikey|authorization|cookie|session|service[-_]?role|client[-_]?secret|card|cvv|cpf)/i;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const LONG_SECRET = /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/g;
const QUERY_SECRET = /([?&](?:token|key|apikey|access_token|signature|secret)=)[^&\s]+/gi;

export function redactString(s: string): string {
  return s
    .replace(JWT, "[jwt-redigido]")
    .replace(BEARER, "$1 [redigido]")
    .replace(QUERY_SECRET, "$1[redigido]")
    .replace(EMAIL, "[email-redigido]")
    .replace(LONG_SECRET, "[segredo-redigido]");
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[profundo]";
  if (typeof value === "string") return redactString(value);
  if (value instanceof Error) return { name: value.name, message: redactString(value.message) };
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE_KEY.test(k) ? "[redigido]" : redact(v, depth + 1);
    return out;
  }
  return value;
}

type Level = "info" | "warn" | "error";

function emit(level: Level, event: string, data?: Record<string, unknown>) {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...(data ? (redact(data) as object) : {}) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (event: string, data?: Record<string, unknown>) => emit("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => emit("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => emit("error", event, data),
};
