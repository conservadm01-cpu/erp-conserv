const TZ = "America/Sao_Paulo";

export function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "medium" });
}

export function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: TZ });
}
