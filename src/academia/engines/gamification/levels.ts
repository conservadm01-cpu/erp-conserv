import type { AppSettings, LevelInfo } from "../../core/types";

/** Traduz XP acumulado em nível, faixa atual e quanto falta para o próximo. */
export function levelInfo(xp: number, levels: AppSettings["levels"]): LevelInfo {
  const sorted = [...levels].sort((a, b) => a.minXp - b.minXp);
  let current = sorted[0];
  let next: AppSettings["levels"][number] | null = null;
  for (let i = 0; i < sorted.length; i += 1) {
    if (xp >= sorted[i].minXp) {
      current = sorted[i];
      next = sorted[i + 1] ?? null;
    }
  }
  const span = next ? next.minXp - current.minXp : 0;
  const progressPct = next && span > 0 ? Math.min(100, ((xp - current.minXp) / span) * 100) : 100;
  return {
    level: current.level,
    name: current.name,
    xp,
    currentLevelXp: current.minXp,
    nextLevelXp: next ? next.minXp : null,
    progressPct,
    xpToNext: next ? Math.max(0, next.minXp - xp) : null,
  };
}
