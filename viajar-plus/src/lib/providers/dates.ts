export function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function nightsBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** Datas de ida a pesquisar com flexibilidade ±n dias (a original primeiro). */
export function flexOffsets(n: number): number[] {
  const out = [0];
  for (let i = 1; i <= n; i++) out.push(-i, i);
  return out;
}
