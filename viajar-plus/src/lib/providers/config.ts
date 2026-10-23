// Leitura das credenciais (somente servidor). Nunca exponha estes valores ao navegador.

export function amadeusConfig() {
  const id = process.env.AMADEUS_CLIENT_ID;
  const secret = process.env.AMADEUS_CLIENT_SECRET;
  const env = process.env.AMADEUS_ENV === "production" ? "production" : "test";
  return {
    configured: Boolean(id && secret),
    id: id ?? "",
    secret: secret ?? "",
    env,
    base: env === "production" ? "https://api.amadeus.com" : "https://test.api.amadeus.com",
  };
}

export function duffelConfig() {
  const token = process.env.DUFFEL_ACCESS_TOKEN;
  return { configured: Boolean(token), token: token ?? "" };
}

/** Provedores fictícios só em desenvolvimento e com opt-in explícito. */
export function mocksEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.ENABLE_MOCK_PROVIDERS === "true";
}

export function contactEmail(): string {
  return process.env.OSM_CONTACT_EMAIL ?? "";
}
