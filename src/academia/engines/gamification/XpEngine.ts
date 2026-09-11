// =====================================================================
// GAMIFICAÇÃO — XP (seção 15)
// ---------------------------------------------------------------------
// Regras de pontuação vêm das configurações (settings.xpRules), não do
// código: o administrador ajusta quanto vale cada atividade.
// Ranking é opcional e por adesão do colaborador (rankingOptIn).
// =====================================================================

import type { ID, LevelInfo, XpTransaction } from "../../core/types";
import { gamificationRepo, peopleRepo, settingsRepo } from "../../data/repositories";
import { uid } from "../../core/ids";
import { nowIso } from "../../core/dates";
import { levelInfo } from "./levels";
import { badgeEngine, type BadgeGrant } from "./BadgeEngine";

export interface XpAward {
  transaction: XpTransaction;
  totalXp: number;
  level: LevelInfo;
  leveledUp: boolean;
  newBadges: BadgeGrant[];
}

export const xpEngine = {
  rules() {
    return settingsRepo.get().xpRules;
  },

  totalXp(employeeId: ID): number {
    return gamificationRepo.totalXp(employeeId);
  },

  level(employeeId: ID): LevelInfo {
    return levelInfo(this.totalXp(employeeId), settingsRepo.get().levels);
  },

  /** Registra XP, recalcula nível e avalia badges em uma única operação. */
  award(
    employeeId: ID,
    amount: number,
    reason: string,
    refType: XpTransaction["refType"],
    refId?: ID,
    options: { skipBadges?: boolean } = {},
  ): XpAward {
    const levels = settingsRepo.get().levels;
    const before = levelInfo(this.totalXp(employeeId), levels);
    const transaction = gamificationRepo.saveXp({
      id: uid("XP"),
      employeeId,
      amount,
      reason,
      refType,
      refId,
      at: nowIso(),
    });
    const totalXp = this.totalXp(employeeId);
    const after = levelInfo(totalXp, levels);
    const newBadges = options.skipBadges ? [] : badgeEngine.evaluate(employeeId);
    return {
      transaction,
      totalXp: this.totalXp(employeeId),
      level: after,
      leveledUp: after.level > before.level,
      newBadges,
    };
  },

  /** Ranking opcional: só entra quem autorizou (privacidade). */
  optInRanking(): Array<{ employeeId: ID; name: string; xp: number; level: LevelInfo }> {
    if (!settingsRepo.get().rankingEnabled) return [];
    const levels = settingsRepo.get().levels;
    return peopleRepo
      .activeEmployees()
      .filter((e) => e.preferences.rankingOptIn)
      .map((e) => {
        const xp = gamificationRepo.totalXp(e.id);
        return { employeeId: e.id, name: e.name, xp, level: levelInfo(xp, levels) };
      })
      .sort((a, b) => b.xp - a.xp);
  },
};
