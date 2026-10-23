import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { log, redact, redactString } from "@/lib/server/log";

describe("log sem segredos", () => {
  it("redige chaves sensíveis em objetos aninhados", () => {
    const out = redact({ user: "u1", password: "123", nested: { access_token: "abc", apiKey: "k", ok: 1 }, card: "4111" }) as Record<string, unknown>;
    expect(out.password).toBe("[redigido]");
    expect(out.card).toBe("[redigido]");
    expect((out.nested as Record<string, unknown>).access_token).toBe("[redigido]");
    expect((out.nested as Record<string, unknown>).apiKey).toBe("[redigido]");
    expect((out.nested as Record<string, unknown>).ok).toBe(1);
    expect(out.user).toBe("u1");
  });

  it("redige JWT, Bearer, e-mails e parâmetros de URL", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const s = redactString(`falha para ana@exemplo.com com ${jwt} e Bearer abcdefghijkl123 em https://x.io/a?token=segredo123&b=1`);
    expect(s).not.toContain("ana@exemplo.com");
    expect(s).not.toContain(jwt);
    expect(s).not.toContain("abcdefghijkl123");
    expect(s).not.toContain("segredo123");
    expect(s).toContain("b=1");
  });

  it("redige cadeias longas com aparência de chave", () => {
    expect(redactString("chave " + ["sk", "live", "51Habc123def456ghi789jkl012mno345"].join("_"))).toContain("[segredo-redigido]");
  });

  it("preserva mensagens comuns e UUIDs curtos de contexto", () => {
    expect(redactString("upload ok de 3 arquivos")).toBe("upload ok de 3 arquivos");
  });

  it("log.error não imprime o segredo", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log.error("teste", { error: new Error("token inválido: eyJaaaaaaaaaa.bbbbbbbbbbbb.cccccccccccc"), secret: "x" });
    const line = spy.mock.calls[0][0] as string;
    expect(line).not.toContain("eyJaaaaaaaaaa");
    expect(JSON.parse(line).secret).toBe("[redigido]");
    spy.mockRestore();
  });
});
