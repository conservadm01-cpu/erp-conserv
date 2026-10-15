export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  unauthenticated: () => new AppError(401, "NAO_AUTENTICADO", "Sessão inválida ou expirada. Entre novamente."),
  forbidden: (message = "Você não tem permissão para esta operação.") =>
    new AppError(403, "ACESSO_NEGADO", message),
  /** Usado também para recursos fora do escopo, para não revelar sua existência. */
  notFound: (what = "Registro") => new AppError(404, "NAO_ENCONTRADO", `${what} não encontrado.`),
  conflict: (message: string) => new AppError(409, "CONFLITO", message),
  invalid: (message: string, details?: unknown) => new AppError(422, "DADOS_INVALIDOS", message, details),
  tooMany: (message = "Muitas tentativas. Aguarde alguns minutos e tente novamente.") =>
    new AppError(429, "MUITAS_TENTATIVAS", message),
  stateRequired: (code: string, message: string) => new AppError(403, code, message),
};
