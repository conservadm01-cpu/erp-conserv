import { describe, expect, it } from "vitest";
import { authenticator } from "otplib";
import { decryptSecret, encryptSecret, sha256Hex } from "@/server/crypto";
import { passwordPolicyIssues, verifyPassword, hashPassword } from "@/server/auth/password";
import { generateRecoveryCodes, normalizeRecoveryCode, verifyTotp } from "@/server/auth/mfa";
import { canonicalJson, REDACTED, sanitizeMetadata } from "@/server/audit/sanitize";
import { checkOrigin } from "@/server/http/handler";
import { safeNext } from "@/lib/api";

describe("criptografia de segredos", () => {
  const key = Buffer.alloc(32, 1);
  it("cifra e decifra", () => {
    const enc = encryptSecret("segredo-totp", key);
    expect(enc).not.toContain("segredo");
    expect(decryptSecret(enc, key)).toBe("segredo-totp");
  });
  it("rejeita conteúdo adulterado ou chave errada", () => {
    const enc = encryptSecret("abc", key);
    const parts = enc.split(".");
    parts[3] = Buffer.from("xyz").toString("base64url");
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
    expect(() => decryptSecret(enc, Buffer.alloc(32, 2))).toThrow();
  });
});

describe("política de senha", () => {
  it("aceita senha forte", () => expect(passwordPolicyIssues("Obra!Segura#2026")).toEqual([]));
  it("rejeita senha curta, simples ou com dados pessoais", () => {
    expect(passwordPolicyIssues("Curta1!")).not.toEqual([]);
    expect(passwordPolicyIssues("somenteminusculas")).not.toEqual([]);
    expect(passwordPolicyIssues("Joaquim@2026xyz", { name: "Joaquim Silva" })).not.toEqual([]);
    expect(passwordPolicyIssues("Maria.Souza@2026", { email: "maria.souza@exemplo.test" })).not.toEqual([]);
  });
  it("hash bcrypt verifica corretamente e trata hash ausente", async () => {
    const h = await hashPassword("Obra!Segura#2026");
    expect(await verifyPassword("Obra!Segura#2026", h)).toBe(true);
    expect(await verifyPassword("errada", h)).toBe(false);
    expect(await verifyPassword("Obra!Segura#2026", null)).toBe(false);
  });
});

describe("MFA (TOTP)", () => {
  const secret = authenticator.generateSecret(20);
  it("aceita código válido e impede reutilização", () => {
    const code = authenticator.generate(secret);
    const step = verifyTotp(secret, code, null);
    expect(step).not.toBeNull();
    expect(verifyTotp(secret, code, step)).toBeNull();
  });
  it("rejeita formatos inválidos e códigos errados", () => {
    expect(verifyTotp(secret, "12345", null)).toBeNull();
    expect(verifyTotp(secret, "abcdef", null)).toBeNull();
    const code = authenticator.generate(secret);
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
    expect(verifyTotp(secret, wrong, null)).toBeNull();
  });
  it("gera códigos de recuperação únicos guardando apenas o hash", () => {
    const { plain, hashes } = generateRecoveryCodes();
    expect(plain).toHaveLength(8);
    expect(new Set(plain).size).toBe(8);
    plain.forEach((c) => expect(c).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/));
    expect(hashes[0]).toBe(sha256Hex(normalizeRecoveryCode(plain[0]!.toLowerCase())));
  });
});

describe("higienização da auditoria", () => {
  it("remove campos sensíveis em qualquer nível", () => {
    const out = sanitizeMetadata({ email: "a@exemplo.test", senha: "x", nested: { accessToken: "t", ok: 1 }, list: [{ password: "p" }] }) as Record<string, unknown>;
    expect(out.senha).toBe(REDACTED);
    expect(out.nested).toEqual({ accessToken: REDACTED, ok: 1 });
    expect(out.list).toEqual([{ password: REDACTED }]);
    expect(out.email).toBe("a@exemplo.test");
  });
  it("JSON canônico independe da ordem das chaves", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
  });
});

describe("proteções HTTP", () => {
  const req = (method: string, headers: Record<string, string>) => new Request("http://localhost:3000/api/x", { method, headers });
  it("bloqueia mutações de outra origem", () => {
    expect(checkOrigin(req("POST", { origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(true);
    expect(checkOrigin(req("POST", { origin: "https://ataque.example", host: "localhost:3000" }))).toBe(false);
    expect(checkOrigin(req("POST", {}))).toBe(false);
    expect(checkOrigin(req("GET", { origin: "https://ataque.example" }))).toBe(true);
  });
  it("redirecionamento pós-login só aceita caminhos internos", () => {
    expect(safeNext("/usuarios")).toBe("/usuarios");
    expect(safeNext("//ataque.example")).toBe("/");
    expect(safeNext("https://ataque.example")).toBe("/");
    expect(safeNext("/\\ataque.example")).toBe("/");
    expect(safeNext(undefined)).toBe("/");
  });
});
