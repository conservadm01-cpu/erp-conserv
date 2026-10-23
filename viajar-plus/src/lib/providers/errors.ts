export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Integração sem credenciais configuradas no servidor. */
export class ProviderNotConfigured extends ProviderError {
  constructor(provider: string) {
    super(`Integração ${provider} não configurada: consulta real indisponível.`, provider, 503);
    this.name = "ProviderNotConfigured";
  }
}

/** Fornecedor fora do ar, timeout ou resposta inválida. */
export class ProviderUnavailable extends ProviderError {
  constructor(provider: string, detail: string) {
    super(`${provider} indisponível no momento (${detail}).`, provider, 502);
    this.name = "ProviderUnavailable";
  }
}

/** O fornecedor recusou por limite de requisições. */
export class RateLimited extends ProviderError {
  constructor(
    provider: string,
    readonly retryAfterSec: number | null,
  ) {
    super(`${provider} atingiu o limite de requisições. Tente novamente mais tarde.`, provider, 429);
    this.name = "RateLimited";
  }
}
