const TZ = "America/Sao_Paulo";

export function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "medium" });
}

export function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: TZ });
}

/** Datas sem hora (colunas DATE) são armazenadas em UTC. */
export function formatDay(d: Date | string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
}

export function toInputDate(d: Date | string | null | undefined) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export function formatBytes(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Tipo de um valor depois de passar por JSON (datas viram texto). */
export type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;

/** Converte dados do servidor para props de componentes de cliente. */
export function serialize<T>(v: T): Serialized<T> {
  return JSON.parse(JSON.stringify(v));
}
