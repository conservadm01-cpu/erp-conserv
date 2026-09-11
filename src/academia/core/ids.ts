// Geração de identificadores legíveis e estáveis.
// Nenhum ID depende do banco, então o mesmo código serve para o protótipo
// (chave/valor no Supabase) e para um banco relacional no futuro.

import type { ID, SourceId } from "./types";

const counters = new Map<string, number>();

function pad(n: number, size = 6): string {
  return String(n).padStart(size, "0");
}

/** Sequencial local por prefixo — ex.: CNT-000001. */
export function seqId(prefix: string, start = 1): ID {
  const next = (counters.get(prefix) ?? start - 1) + 1;
  counters.set(prefix, next);
  return `${prefix}-${pad(next)}`;
}

/** Informa ao gerador qual é o maior número já usado (lido do banco). */
export function primeCounter(prefix: string, value: number): void {
  const current = counters.get(prefix) ?? 0;
  if (value > current) counters.set(prefix, value);
}

export function primeFromIds(prefix: string, ids: string[]): void {
  let max = 0;
  for (const id of ids) {
    if (!id.startsWith(prefix + "-")) continue;
    const n = Number(id.slice(prefix.length + 1));
    if (Number.isFinite(n) && n > max) max = n;
  }
  primeCounter(prefix, max);
}

let randomSeed = 0;
/** ID único curto para registros de uso (tentativas, sessões, logs). */
export function uid(prefix = "ID"): ID {
  randomSeed += 1;
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${time}${rand}${randomSeed.toString(36)}`;
}

/** SOURCE_ID: aponta para um trecho específico de um material. */
export function sourceId(contentId: ID, chunkIndex: number): SourceId {
  return `SRC:${contentId}#${chunkIndex}`;
}

export function parseSourceId(value: SourceId): { contentId: ID; chunkIndex: number } | null {
  const m = /^SRC:([^#]+)#(\d+)$/.exec(value);
  if (!m) return null;
  return { contentId: m[1], chunkIndex: Number(m[2]) };
}

const CERT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Código de certificado: CSV-A1B2-C3D4 (sem caracteres ambíguos). */
export function certificateCode(): string {
  const block = (n: number) =>
    Array.from({ length: n }, () => CERT_ALPHABET[Math.floor(Math.random() * CERT_ALPHABET.length)]).join("");
  return `CSV-${block(4)}-${block(4)}`;
}

export function riskCode(sequence: number): string {
  const year = new Date().getFullYear();
  return `RSK-${year}-${pad(sequence, 4)}`;
}
