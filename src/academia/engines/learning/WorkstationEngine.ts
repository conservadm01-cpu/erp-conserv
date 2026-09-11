// =====================================================================
// MODO "APRENDER NO POSTO" (seção 27)
// ---------------------------------------------------------------------
// O colaborador escolhe a máquina e o sintoma; o motor procura, em TODO
// o conteúdo publicado, os roteiros de verificação, aulas, desafios e
// jogos que tratam daquele sintoma.
//
// Por que isso importa: quando um material novo é enviado e analisado, o
// "Aprender no posto" passa a responder melhor sozinho — sem código novo.
//
// Limite de segurança: o motor só mostra verificações educativas. Tudo
// que envolve abrir a máquina, faca, sincronismo ou parte elétrica vira
// orientação de parar e chamar a manutenção.
// =====================================================================

import type { Challenge, GameDefinition, ID, Lesson, SourceRef } from "../../core/types";
import { catalogRepo } from "../../data/repositories";
import { normalize, similarity, splitSentences, truncate } from "../../core/text";

export interface MachineOption {
  id: string;
  label: string;
  competencyId: ID;
  keywords: string[];
}

export interface SymptomOption {
  id: string;
  label: string;
  keywords: string[];
  /** Sintomas que exigem parar a máquina e acionar a manutenção. */
  stopMachine?: boolean;
}

export const MACHINES: MachineOption[] = [
  { id: "reta", label: "Reta", competencyId: "CMP-RETA", keywords: ["reta", "ponto corrente", "calcador", "lançadeira"] },
  { id: "overloque", label: "Overloque", competencyId: "CMP-OVERLOQUE", keywords: ["overloque", "looper", "faca", "diferencial"] },
  { id: "galoneira", label: "Galoneira", competencyId: "CMP-GALONEIRA", keywords: ["galoneira", "barra", "galão"] },
  { id: "interlock", label: "Interlock", competencyId: "CMP-INTERLOCK", keywords: ["interlock", "fechamento", "travete"] },
];

export const SYMPTOMS: SymptomOption[] = [
  { id: "linha-arrebentando", label: "Linha arrebentando", keywords: ["linha arrebenta", "arrebentando", "rompe", "tensão", "passamento", "agulha"] },
  { id: "ponto-pulando", label: "Ponto pulando", keywords: ["ponto pulando", "pulando", "falha", "agulha", "passamento", "sincronismo"] },
  { id: "tecido-franzindo", label: "Tecido franzindo", keywords: ["franzindo", "franzido", "diferencial", "tensão", "calcador"] },
  { id: "ponto-frouxo", label: "Ponto frouxo", keywords: ["frouxo", "tensão baixa", "abre", "laçada"] },
  { id: "ponto-apertado", label: "Ponto apertado", keywords: ["apertado", "dura", "tensão alta", "marca"] },
  { id: "ruido", label: "Ruído estranho", keywords: ["ruído", "ruido", "estalo", "esquentando", "mecanismo"], stopMachine: true },
  { id: "agulha-quebrando", label: "Agulha quebrando", keywords: ["agulha quebrando", "quebra", "torta", "cega", "descarte"], stopMachine: true },
  { id: "ponto-irregular", label: "Ponto irregular", keywords: ["irregular", "fiapo", "transporte", "limpeza", "passamento"] },
];

export interface WorkstationGuide {
  machine: MachineOption;
  symptom: SymptomOption;
  /** Passos de verificação extraídos de materiais publicados. */
  checks: Array<{ step: string; sourceRef: SourceRef }>;
  /** Frases relevantes quando o material não traz passo a passo. */
  notes: Array<{ text: string; sourceRef: SourceRef }>;
  lessons: Lesson[];
  challenges: Challenge[];
  games: GameDefinition[];
  stopMachine: boolean;
  safetyMessage: string;
}

function matches(text: string, keywords: string[]): number {
  const haystack = normalize(text);
  let score = 0;
  for (const keyword of keywords) {
    if (haystack.includes(normalize(keyword))) score += 1;
  }
  return score;
}

export const workstationEngine = {
  /** Monta o guia educativo para máquina + sintoma. */
  guide(machineId: string, symptomId: string): WorkstationGuide | null {
    const machine = MACHINES.find((m) => m.id === machineId);
    const symptom = SYMPTOMS.find((s) => s.id === symptomId);
    if (!machine || !symptom) return null;
    const keywords = [...symptom.keywords, ...machine.keywords];

    const checks: WorkstationGuide["checks"] = [];
    const notes: WorkstationGuide["notes"] = [];

    for (const content of catalogRepo.contents()) {
      if (content.status !== "published") continue;
      const contentScore = matches(`${content.title} ${content.description} ${content.keywords.join(" ")}`, machine.keywords);

      // 1. Roteiros numerados identificados na análise do material.
      for (const procedure of content.analysis?.procedures ?? []) {
        const score = matches(`${procedure.title} ${procedure.steps.join(" ")}`, symptom.keywords);
        if (score + contentScore < 2) continue;
        for (const step of procedure.steps) {
          if (checks.some((c) => similarity(c.step, step) > 0.7)) continue;
          checks.push({ step: truncate(step, 180), sourceRef: procedure.sourceRef });
        }
      }

      // 2. Trechos do material que tratam do sintoma.
      for (const chunk of content.chunks) {
        const score = matches(chunk.text, symptom.keywords);
        if (score + contentScore < 3) continue;
        for (const sentence of splitSentences(chunk.text)) {
          if (matches(sentence, symptom.keywords) === 0) continue;
          if (notes.some((n) => similarity(n.text, sentence) > 0.6)) continue;
          notes.push({
            text: truncate(sentence, 220),
            sourceRef: {
              sourceId: chunk.sourceId,
              contentId: content.id,
              excerpt: truncate(chunk.text, 220),
              locator: chunk.locator,
              librarySourceId: content.librarySourceIds[0],
            },
          });
          if (notes.length >= 8) break;
        }
      }
    }

    const lessons = catalogRepo
      .publishedCourses()
      .flatMap((course) => catalogRepo.orderedLessons(course.id))
      .map((lesson) => ({
        lesson,
        score: matches(`${lesson.title} ${lesson.summary} ${JSON.stringify(lesson.blocks)}`, keywords),
      }))
      .filter((item) => item.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.lesson);

    const challenges = catalogRepo
      .publishedChallenges()
      .map((challenge) => ({ challenge, score: matches(`${challenge.title} ${challenge.scenario} ${challenge.explanation}`, keywords) }))
      .filter((item) => item.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((item) => item.challenge);

    const games = catalogRepo
      .publishedGames()
      .filter((game) => game.competencies.includes(machine.competencyId) || game.competencies.includes("CMP-REGULAGEM"))
      .slice(0, 2);

    return {
      machine,
      symptom,
      checks: checks.slice(0, 8),
      notes: notes.slice(0, 5),
      lessons,
      challenges,
      games,
      stopMachine: !!symptom.stopMachine,
      safetyMessage: symptom.stopMachine
        ? "Pare a máquina e solicite apoio da manutenção. Ruído novo, aquecimento, cheiro de queimado ou agulha quebrando de forma repetida são sinais mecânicos — não tente resolver abrindo a máquina."
        : "Se as verificações acima não resolverem, pare a máquina e solicite apoio da manutenção. Ajuste de faca, sincronismo e qualquer parte interna não são tarefa do operador.",
    };
  },
};
