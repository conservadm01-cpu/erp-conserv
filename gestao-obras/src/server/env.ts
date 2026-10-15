import { z } from "zod";

const boolish = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** Chave de 32 bytes em base64 usada para cifrar segredos MFA. */
  APP_ENCRYPTION_KEY: z.string().optional(),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(720).default(60),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(72).default(12),
  TRUST_PROXY: boolish,
  MAIL_DRIVER: z.enum(["console", "memory", "smtp"]).default("console"),
  MAIL_FROM: z.string().default("Gestão de Obras <nao-responda@localhost>"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: boolish,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

// Chave usada apenas fora de produção, para o sistema iniciar sem configuração.
const DEV_ENCRYPTION_KEY = Buffer.alloc(32, "gestao-obras-dev-key").toString("base64");

let cached: (Env & { encryptionKey: Buffer }) | undefined;

export function env() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuração inválida: ${issues}`);
  }
  const e = parsed.data;
  let keyB64 = e.APP_ENCRYPTION_KEY;
  if (!keyB64) {
    if (e.NODE_ENV === "production") {
      throw new Error("APP_ENCRYPTION_KEY é obrigatória em produção.");
    }
    keyB64 = DEV_ENCRYPTION_KEY;
  }
  const encryptionKey = Buffer.from(keyB64, "base64");
  if (encryptionKey.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY deve conter exatamente 32 bytes em base64.");
  }
  if (e.MAIL_DRIVER === "smtp" && !e.SMTP_HOST) {
    throw new Error("MAIL_DRIVER=smtp exige SMTP_HOST.");
  }
  cached = { ...e, encryptionKey };
  return cached;
}

export function isSecureCookie() {
  return env().APP_URL.startsWith("https://");
}
