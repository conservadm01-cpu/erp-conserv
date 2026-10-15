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

/** Envio de formulário com arquivo (multipart). */
export async function apiUpload<T = unknown>(path: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: "POST", body: form, credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiError(0, "SEM_CONEXAO", "Não foi possível conectar ao servidor. Verifique sua conexão.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.error ?? {};
    const details = e.details && typeof e.details === "object" && !Array.isArray(e.details) ? e.details : {};
    throw new ApiError(res.status, e.code ?? "ERRO", e.message ?? "Erro inesperado.", details, e.correlationId);
  }
  return data as T;
}

/** Solicita a URL temporária e inicia o download. */
export async function downloadVersion(documentId: string, versionId: string) {
  const { url } = await api<{ url: string }>(`/api/documents/${documentId}/versions/${versionId}/download`, { method: "POST" });
  window.location.assign(url);
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

/** Baixa um arquivo gerado pela API (ex.: relatório PDF), mostrando o erro do servidor quando houver. */
export async function downloadFile(path: string, fallbackName: string) {
  let res: Response;
  try {
    res = await fetch(path, { credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiError(0, "SEM_CONEXAO", "Não foi possível conectar ao servidor. Verifique sua conexão.");
  }
  if (!res.ok) {
    const e = (await res.json().catch(() => ({})))?.error ?? {};
    throw new ApiError(res.status, e.code ?? "ERRO", e.message ?? "Erro inesperado.", e.details && typeof e.details === "object" ? e.details : {}, e.correlationId);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
