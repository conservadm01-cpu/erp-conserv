"use client";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: Record<string, string[]> = {},
    public readonly correlationId?: string,
  ) {
    super(message);
  }
}

/** Chamada à API da própria aplicação, com tratamento de erro padronizado. */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "SEM_CONEXAO", "Não foi possível conectar ao servidor. Verifique sua conexão.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.error ?? {};
    const details = e.details && typeof e.details === "object" && !Array.isArray(e.details) ? e.details : {};
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/")) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiError(res.status, e.code ?? "ERRO", e.message ?? "Erro inesperado.", details, e.correlationId);
  }
  return data as T;
}

export const STATE_ROUTES: Record<string, string> = {
  OK: "/",
  MFA_PENDENTE: "/mfa",
  MFA_CADASTRO_OBRIGATORIO: "/mfa/cadastro",
  TROCA_SENHA_OBRIGATORIA: "/trocar-senha",
};

/** Aceita apenas caminhos internos como destino após o login (evita redirecionamento aberto). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
