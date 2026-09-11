// =====================================================================
// GAME_ENGINE (seção 11)
// ---------------------------------------------------------------------
// O motor não conhece "jogos": conhece MECÂNICAS (diagnóstico, sequência,
// hotspot, quiz cronometrado). Cada jogo é um registro de dados que
// aponta para uma mecânica e traz o seu conteúdo. Para criar um tipo novo
// de jogo, registra-se uma mecânica nova aqui e um renderizador na UI —
// os jogos em si continuam sendo dados.
// =====================================================================

import type { GameDefinition, GamePayload, GameSession, GameType, ID } from "../../core/types";
import { catalogRepo, learningRepo, settingsRepo } from "../../data/repositories";
import { uid } from "../../core/ids";
import { nowIso } from "../../core/dates";
import { xpEngine } from "../gamification/XpEngine";
import type { BadgeGrant } from "../gamification/BadgeEngine";
import { competencyEngine } from "../competency/CompetencyEngine";

export type GameMechanic = GamePayload["kind"];

export interface MechanicMeta {
  mechanic: GameMechanic;
  label: string;
  description: string;
  /** Quantos "acertos" existem em cada rodada — define a pontuação máxima. */
  scoreOf: (payload: GamePayload) => number;
}

const MECHANICS: Record<GameMechanic, MechanicMeta> = {
  diagnosis: {
    mechanic: "diagnosis",
    label: "Diagnóstico",
    description: "Situação apresentada, o jogador escolhe a causa ou a conduta correta.",
    scoreOf: (p) => (p.kind === "diagnosis" ? p.rounds.length : 0),
  },
  sequence: {
    mechanic: "sequence",
    label: "Sequência",
    description: "Ordenar operações ou etapas do processo.",
    scoreOf: (p) => (p.kind === "sequence" ? p.rounds.reduce((sum, r) => sum + r.items.length, 0) : 0),
  },
  hotspot: {
    mechanic: "hotspot",
    label: "Observação",
    description: "Encontrar pontos corretos numa cena (riscos, defeitos).",
    scoreOf: (p) => (p.kind === "hotspot" ? p.rounds.reduce((sum, r) => sum + r.targetsToFind, 0) : 0),
  },
  timed_quiz: {
    mechanic: "timed_quiz",
    label: "Contra o tempo",
    description: "Perguntas rápidas com limite de tempo.",
    scoreOf: (p) => (p.kind === "timed_quiz" ? p.rounds.reduce((sum, r) => sum + Math.max(r.questionIds.length, r.inlineQuestions?.length ?? 0), 0) : 0),
  },
};

/** Mecânica usada por cada tipo de jogo publicado. */
export const GAME_TYPE_MECHANIC: Record<GameType, GameMechanic> = {
  qual_e_o_defeito: "diagnosis",
  salve_a_maquina: "diagnosis",
  monte_a_peca: "sequence",
  caca_ao_risco: "hotspot",
  mestre_da_qualidade: "hotspot",
  desafio_60s: "timed_quiz",
};

export const GAME_TYPE_LABELS: Record<GameType, string> = {
  qual_e_o_defeito: "Qual é o defeito?",
  monte_a_peca: "Monte a peça",
  caca_ao_risco: "Caça ao risco",
  salve_a_maquina: "Salve a máquina",
  mestre_da_qualidade: "Mestre da qualidade",
  desafio_60s: "Desafio dos 60 segundos",
};

export interface GameOutcome {
  session: GameSession;
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  xpEarned: number;
  leveledUp: boolean;
  newBadges: BadgeGrant[];
}

export const gameEngine = {
  mechanics(): MechanicMeta[] {
    return Object.values(MECHANICS);
  },

  mechanicOf(game: GameDefinition): MechanicMeta {
    return MECHANICS[game.payload.kind];
  },

  maxScore(game: GameDefinition): number {
    return MECHANICS[game.payload.kind].scoreOf(game.payload);
  },

  /** Fecha a partida: grava, pontua e registra evidência. */
  finish(
    game: GameDefinition,
    employeeId: ID,
    details: Array<{ roundId: ID; correct: boolean; competencies?: ID[] }>,
    startedAt: string,
    scoreOverride?: number,
  ): GameOutcome {
    const maxScore = scoreOverride !== undefined ? Math.max(details.length, scoreOverride) : this.maxScore(game);
    const score = details.filter((d) => d.correct).length;
    const percent = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);
    const passed = percent >= game.passScore;
    const finishedAt = nowIso();

    const base = game.xp || settingsRepo.get().xpRules.game;
    const xpEarned = Math.round(base * (percent / 100)) + (passed ? 20 : 0);

    // Grava a partida uma única vez, já com o XP — o motor de badges lê as
    // partidas durante o award.
    const session = learningRepo.saveGameSession({
      id: uid("GSS"),
      gameId: game.id,
      employeeId,
      score,
      maxScore,
      passed,
      startedAt,
      finishedAt,
      durationSec: Math.max(1, Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000)),
      xpEarned,
      details: details.map((d) => ({ roundId: d.roundId, correct: d.correct, competencies: d.competencies ?? game.competencies })),
    });

    const award = xpEngine.award(employeeId, xpEarned, `Jogo: ${game.title} (${percent}%)`, "jogo", game.id);

    for (const competencyId of game.competencies) {
      competencyEngine.registerEvidence(employeeId, competencyId, "jogo", game.id, `Jogo: ${game.title}`, percent / 100);
    }

    return {
      session,
      score,
      maxScore,
      percent,
      passed,
      xpEarned,
      leveledUp: award.leveledUp,
      newBadges: award.newBadges,
    };
  },

  /** Jogos recomendados para uma competência (usado no reforço). */
  gamesForCompetency(competencyId: ID): GameDefinition[] {
    return catalogRepo.publishedGames().filter((g) => g.competencies.includes(competencyId));
  },
};
