// =====================================================================
// ANALISADOR LOCAL (heurístico)
// ---------------------------------------------------------------------
// Lê o material já extraído e produz a estrutura pedagógica: conceitos,
// definições, procedimentos, riscos, exemplos, resumo, nível, aulas,
// curiosidades, questões, jogos e desafios — tudo com SOURCE_ID.
//
// Princípio: NADA é inventado. Cada item gerado nasce de um trecho real
// do material. Quando a geração depende de interpretação, o item é
// marcado como incerto e entra na lista de avisos para revisão humana.
// =====================================================================

import type {
  AiSettings, ContentAnalysis, ContentChunk, ContentItem, ContentLevel, DetectedProcedure, DetectedRisk,
  DetectedTerm, GameType, LessonBlock, QuestionDifficulty, SourceRef, SuggestedChallenge, SuggestedCuriosity,
  SuggestedGame, SuggestedLesson, SuggestedQuestion,
} from "../../../core/types";
import {
  capitalize, extractDefinition, normalize, readingMinutes, similarity, splitSentences, titleCaseTerm, topTerms,
  truncate, wordCount,
} from "../../../core/text";
import { nowIso } from "../../../core/dates";
import type { ContentAnalyzer } from "../ai/AiProvider";
import { PROCEDURE_MARKERS, RISK_MARKERS, findTerms, hasMarker, mutateStatement, suggestCategory } from "./TechnicalLexicon";

interface Sentence {
  text: string;
  chunk: ContentChunk;
}

function refFor(content: ContentItem, chunk: ContentChunk, excerpt: string, uncertain = false): SourceRef {
  return {
    sourceId: chunk.sourceId,
    contentId: content.id,
    excerpt: truncate(excerpt, 220),
    locator: chunk.locator,
    librarySourceId: content.librarySourceIds[0],
    uncertain,
  };
}

function collectSentences(content: ContentItem): Sentence[] {
  const out: Sentence[] = [];
  for (const chunk of content.chunks) {
    for (const text of splitSentences(chunk.text)) {
      if (wordCount(text) < 5) continue;
      out.push({ text, chunk });
    }
  }
  return out;
}

/**
 * Passos numerados escritos dentro de um parágrafo
 * ("1. Confira… 2. Meça… 3. Enfeste…").
 */
function inlineSteps(text: string): string[] {
  const matches = [...text.matchAll(/(\d{1,2})[.)]\s+/g)];
  if (matches.length < 3) return [];
  const numbers = matches.map((m) => Number(m[1]));
  if (numbers[0] !== 1) return [];
  for (let i = 1; i < numbers.length; i += 1) if (numbers[i] !== numbers[i - 1] + 1) return [];
  const steps: string[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? text.length : text.length;
    const step = text.slice(start, end).trim().replace(/[;,]$/, "");
    if (step.length > 4) steps.push(step);
  }
  return steps.length >= 3 ? steps : [];
}

function estimateDifficulty(content: ContentItem, termCount: number): ContentLevel {
  const words = wordCount(content.rawText ?? "");
  const density = words === 0 ? 0 : (termCount / words) * 1000;
  const sentences = splitSentences(content.rawText ?? "");
  const avgLen = sentences.length === 0 ? 0 : words / sentences.length;
  if (density > 22 || avgLen > 26) return "avancado";
  if (density > 10 || avgLen > 19) return "intermediario";
  return "basico";
}

function pickDifficulty(mix: Record<QuestionDifficulty, number>, index: number): QuestionDifficulty {
  const order: QuestionDifficulty[] = ["facil", "medio", "dificil"];
  const total = order.reduce((sum, k) => sum + (mix[k] ?? 0), 0) || 1;
  const position = (index % 10) / 10;
  let acc = 0;
  for (const key of order) {
    acc += (mix[key] ?? 0) / total;
    if (position < acc) return key;
  }
  return "medio";
}

export class HeuristicAnalyzer implements ContentAnalyzer {
  readonly name = "Analisador local ConServ (heurístico)";

  async analyze(content: ContentItem, settings: AiSettings): Promise<ContentAnalysis> {
    const text = content.rawText ?? content.chunks.map((c) => c.text).join("\n\n");
    const sentences = collectSentences(content);
    const warnings: string[] = [];

    // ---------- conceitos e termos ----------
    const hits = findTerms(text);
    const concepts: DetectedTerm[] = hits.slice(0, 16).map((hit) => {
      const chunks = content.chunks.filter((c) => normalize(c.text).includes(normalize(hit.entry.term)));
      return {
        term: titleCaseTerm(hit.entry.term),
        occurrences: hit.occurrences,
        sourceRefs: chunks.slice(0, 3).map((c) => refFor(content, c, c.text)),
        competencyId: hit.entry.competencies[0],
      };
    });
    const freeTerms = topTerms(text, 14)
      .map((t) => t.term)
      .filter((t) => !hits.some((h) => normalize(h.entry.term) === normalize(t)));

    // ---------- definições ----------
    const definitions: ContentAnalysis["definitions"] = [];
    for (const sentence of sentences) {
      const found = extractDefinition(sentence.text);
      if (!found) continue;
      if (definitions.some((d) => normalize(d.term) === normalize(found.term))) continue;
      definitions.push({ term: capitalize(found.term), text: found.text, sourceRef: refFor(content, sentence.chunk, sentence.text) });
      if (definitions.length >= 14) break;
    }
    for (const def of definitions) {
      const existing = concepts.find((c) => normalize(c.term) === normalize(def.term));
      if (existing) existing.definition = def.text;
      else concepts.push({ term: def.term, occurrences: 1, sourceRefs: [def.sourceRef], definition: def.text });
    }

    // ---------- procedimentos ----------
    const procedures: DetectedProcedure[] = [];
    for (const chunk of content.chunks) {
      const steps = inlineSteps(chunk.text);
      if (steps.length === 0) continue;
      const intro = splitSentences(chunk.text)[0] ?? chunk.text;
      procedures.push({
        title: truncate(intro.replace(/:$/, ""), 90),
        steps: steps.map((s) => truncate(s, 160)),
        sourceRef: refFor(content, chunk, chunk.text),
      });
    }
    if (procedures.length === 0 && hasMarker(text, PROCEDURE_MARKERS)) {
      warnings.push("O material menciona procedimento, mas não foi possível identificar uma lista de passos numerada. Revise se falta estrutura no original.");
    }

    // ---------- riscos ----------
    const risks: DetectedRisk[] = [];
    for (const sentence of sentences) {
      if (!hasMarker(sentence.text, RISK_MARKERS)) continue;
      if (risks.some((r) => similarity(r.description, sentence.text) > 0.6)) continue;
      risks.push({
        description: truncate(sentence.text, 220),
        category: suggestCategory(sentence.text).category,
        sourceRef: refFor(content, sentence.chunk, sentence.text),
      });
      if (risks.length >= 10) break;
    }

    // ---------- exemplos ----------
    const examples = sentences
      .filter((s) => /por exemplo|como no caso|na prática|imagine/i.test(s.text))
      .slice(0, 6)
      .map((s) => ({ text: truncate(s.text, 220), sourceRef: refFor(content, s.chunk, s.text) }));

    // ---------- resumo, assuntos, nível ----------
    const category = suggestCategory(text);
    const lead = sentences.slice(0, 2).map((s) => s.text).join(" ");
    const subjects = [...new Set([...concepts.slice(0, 6).map((c) => c.term), ...freeTerms.slice(0, 4).map(titleCaseTerm)])];
    const summary = truncate(
      `${lead} Principais assuntos: ${subjects.slice(0, 6).join(", ")}.`,
      520,
    );
    const difficulty = estimateDifficulty(content, hits.reduce((sum, h) => sum + h.occurrences, 0));

    // ---------- aulas sugeridas ----------
    const lessons = this.buildLessons(content, settings, definitions, procedures, risks);

    // ---------- curiosidades ----------
    const curiosities = this.buildCuriosities(content, settings, sentences, category.category);

    // ---------- questões ----------
    const questions = this.buildQuestions(content, settings, definitions, procedures, sentences, category.competencies);
    const lowConfidence = questions.filter((q) => q.confidence < 0.6).length;
    if (lowConfidence > 0) {
      warnings.push(`${lowConfidence} questão(ões) foram geradas por interpretação do texto e estão marcadas como incertas — confira enunciado e alternativas antes de aprovar.`);
    }
    if (questions.length < settings.questionsPerContent) {
      warnings.push(`Foram geradas ${questions.length} de ${settings.questionsPerContent} questões pedidas: o material não oferece base suficiente para mais sem inventar informação.`);
    }

    // ---------- jogos ----------
    const games = this.buildGames(content, settings, questions, procedures, risks);
    const blockedHotspot = settings.allowedGameTypes.filter((t) => t === "caca_ao_risco" || t === "mestre_da_qualidade");
    if (blockedHotspot.length > 0 && risks.length > 0) {
      warnings.push("Jogos de observação (Caça ao Risco / Mestre da Qualidade) precisam de uma cena com pontos marcados — monte a cena no painel de jogos para transformar os riscos identificados em partida.");
    }

    // ---------- desafios ----------
    const challenges = this.buildChallenges(content, settings, sentences, risks);

    // ---------- avisos de conformidade ----------
    if (content.contentType === "norma" || /nr-?\d|norma regulamentadora|legisla/i.test(text)) {
      warnings.push("Material de base normativa: o conteúdo gerado deve ser apresentado como educativo, sem virar aconselhamento jurídico, e a redação oficial vigente deve ser conferida pelo responsável técnico.");
    }
    if (wordCount(text) < 160) {
      warnings.push("Material curto: a análise tem pouca base. Considere enviar o documento completo.");
    }
    if (content.librarySourceIds.length === 0) {
      warnings.push("Nenhuma fonte da biblioteca foi vinculada a este material — vincule antes de publicar para manter a rastreabilidade.");
    }

    return {
      analyzedAt: nowIso(),
      provider: this.name,
      summary,
      subjects,
      concepts,
      terms: freeTerms,
      definitions,
      procedures,
      risks,
      examples,
      competencies: category.competencies,
      difficulty,
      readingMinutes: readingMinutes(text),
      suggestions: { lessons, curiosities, questions, games, challenges },
      warnings,
      stats: { words: wordCount(text), sentences: sentences.length, chunks: content.chunks.length },
    };
  }

  // -------------------------------------------------------------------
  // Aulas: agrupa os trechos do material em blocos de aula, mantendo o
  // texto original (com SOURCE_ID) e acrescentando destaque de definição,
  // passo a passo e alerta de segurança quando existirem.
  // -------------------------------------------------------------------
  private buildLessons(
    content: ContentItem,
    settings: AiSettings,
    definitions: ContentAnalysis["definitions"],
    procedures: DetectedProcedure[],
    risks: DetectedRisk[],
  ): SuggestedLesson[] {
    const target = Math.max(1, settings.lessonsPerContent);
    const chunks = content.chunks.filter((c) => wordCount(c.text) > 12);
    if (chunks.length === 0) return [];
    const perLesson = Math.max(1, Math.ceil(chunks.length / target));
    const lessons: SuggestedLesson[] = [];

    for (let i = 0; i < chunks.length; i += perLesson) {
      const group = chunks.slice(i, i + perLesson);
      const hits = findTerms(group.map((c) => c.text).join(" "));
      const focus = hits[0] ? titleCaseTerm(hits[0].entry.term) : `Parte ${lessons.length + 1}`;
      const blocks: LessonBlock[] = [
        { kind: "character", character: content.category === "seguranca" ? "seguranca" : "mestre", text: `Vamos ver ${focus.toLowerCase()} na prática — do jeito que acontece aqui.` },
      ];
      for (const chunk of group) {
        const steps = inlineSteps(chunk.text);
        if (steps.length > 0) {
          const intro = splitSentences(chunk.text)[0];
          if (intro) blocks.push({ kind: "text", text: intro, sourceId: chunk.sourceId });
          blocks.push({ kind: "steps", steps: steps.map((s) => truncate(s, 180)), sourceId: chunk.sourceId });
        } else {
          blocks.push({ kind: "text", text: chunk.text, sourceId: chunk.sourceId });
        }
      }
      const definition = definitions.find((d) => group.some((c) => c.sourceId === d.sourceRef.sourceId));
      if (definition) {
        blocks.push({ kind: "callout", tone: "info", title: definition.term, text: definition.text, sourceId: definition.sourceRef.sourceId });
      }
      const risk = risks.find((r) => group.some((c) => c.sourceId === r.sourceRef.sourceId));
      if (risk) blocks.push({ kind: "safety", text: risk.description });

      const competencies = [...new Set(hits.flatMap((h) => h.entry.competencies))].slice(0, 3);
      lessons.push({
        title: `${focus}${lessons.length === 0 ? "" : ` — parte ${lessons.length + 1}`}`,
        summary: truncate(group[0].text, 140),
        blocks,
        durationMin: Math.max(4, readingMinutes(group.map((c) => c.text).join(" ")) + 2),
        competencies: competencies.length > 0 ? competencies : content.competencies.slice(0, 2),
        sourceRefs: group.map((c) => refFor(content, c, c.text)),
      });
      if (lessons.length >= target) break;
    }
    // Fecha a última aula com a mensagem do personagem (experiência, seção 34).
    const last = lessons[lessons.length - 1];
    if (last) last.blocks.push({ kind: "character", character: "mestre", text: "Bom trabalho. Agora vem a parte que vale: mostrar isso no posto." });
    if (procedures.length > 0 && lessons.length > 0) {
      lessons[0].blocks.push({ kind: "callout", tone: "dica", title: "Passo a passo", text: `Este material traz ${procedures.length} roteiro(s) de procedimento. Eles viraram lista de passos nas aulas.` });
    }
    return lessons;
  }

  // -------------------------------------------------------------------
  // Curiosidades: frases do próprio material que explicam uma causa ou
  // apresentam um número — reescritas apenas no enquadramento.
  // -------------------------------------------------------------------
  private buildCuriosities(content: ContentItem, settings: AiSettings, sentences: Sentence[], category: string): SuggestedCuriosity[] {
    const candidates = sentences.filter((s) =>
      /porque|por isso|evita|reduz|aumenta|causa|quanto mais|\d/i.test(s.text) && wordCount(s.text) >= 8 && wordCount(s.text) <= 45);
    const out: SuggestedCuriosity[] = [];
    for (const candidate of candidates) {
      if (out.length >= Math.max(1, settings.curiositiesPerContent)) break;
      if (out.some((c) => similarity(c.text, candidate.text) > 0.5)) continue;
      const hits = findTerms(candidate.text);
      const title = hits[0] ? titleCaseTerm(hits[0].entry.term) : truncate(candidate.text, 48);
      const body = candidate.text.trim();
      const lowered = body.charAt(0).toLowerCase() + body.slice(1);
      out.push({
        title,
        text: `Você sabia que ${lowered.replace(/\.$/, "")}?`,
        category,
        sourceRef: refFor(content, candidate.chunk, candidate.text),
      });
    }
    return out;
  }

  // -------------------------------------------------------------------
  // Questões: três famílias, todas ancoradas no texto.
  //   definição  → "O que é X?"            (alta confiança)
  //   passo      → "Qual é a 1ª etapa…?"    (alta confiança)
  //   afirmação  → "Qual está correta?"     (confiança média: distratores
  //                                          são variações da frase real)
  // -------------------------------------------------------------------
  private buildQuestions(
    content: ContentItem,
    settings: AiSettings,
    definitions: ContentAnalysis["definitions"],
    procedures: DetectedProcedure[],
    sentences: Sentence[],
    competencies: string[],
  ): SuggestedQuestion[] {
    const wanted = Math.max(1, settings.questionsPerContent);
    const out: SuggestedQuestion[] = [];
    const comps = (extra?: string) => [...new Set([extra, ...competencies].filter(Boolean))].slice(0, 3) as string[];

    // 1. Definições
    for (const definition of definitions) {
      if (out.length >= wanted) break;
      const others = definitions.filter((d) => d.term !== definition.term).map((d) => truncate(d.text, 120));
      if (others.length < 3) break;
      out.push({
        stem: `Segundo o material "${content.title}", o que é ${definition.term.toLowerCase()}?`,
        options: [truncate(definition.text, 120), others[0], others[1], others[2]],
        correctIndex: 0,
        explanation: `${definition.term}: ${definition.text} (trecho do material, ${definition.sourceRef.locator ?? "origem registrada"}).`,
        difficulty: pickDifficulty(settings.questionDifficultyMix, out.length),
        type: "conhecimento",
        subject: definition.term,
        competencies: comps(),
        sourceRef: definition.sourceRef,
        confidence: 0.9,
      });
    }

    // 2. Procedimentos
    for (const procedure of procedures) {
      if (out.length >= wanted) break;
      if (procedure.steps.length < 3) continue;
      const [first, second, third, fourth] = procedure.steps;
      out.push({
        stem: `No procedimento "${truncate(procedure.title, 70)}", qual é a primeira etapa?`,
        options: [truncate(first, 120), truncate(second, 120), truncate(third, 120), truncate(fourth ?? procedure.steps[procedure.steps.length - 1], 120)],
        correctIndex: 0,
        explanation: `A sequência do material começa por: ${truncate(first, 160)}.`,
        difficulty: "medio",
        type: "sequencia_operacional",
        subject: truncate(procedure.title, 60),
        competencies: comps(),
        sourceRef: procedure.sourceRef,
        confidence: 0.85,
      });
      if (out.length < wanted && procedure.steps.length >= 4) {
        out.push({
          stem: `Ainda no procedimento "${truncate(procedure.title, 70)}", o que vem imediatamente depois de "${truncate(first, 60)}"?`,
          options: [truncate(second, 120), truncate(third, 120), truncate(procedure.steps[procedure.steps.length - 1], 120), truncate(first, 120)],
          correctIndex: 0,
          explanation: `Na ordem registrada no material, depois de "${truncate(first, 80)}" vem "${truncate(second, 80)}".`,
          difficulty: "medio",
          type: "sequencia_operacional",
          subject: truncate(procedure.title, 60),
          competencies: comps(),
          sourceRef: procedure.sourceRef,
          confidence: 0.8,
        });
      }
    }

    // 3. Afirmações verdadeiras x variações
    //    Frases que são item de lista ("2. Retire o fiapo…") ficam de fora:
    //    fora do contexto do roteiro elas viram enunciado sem sentido.
    const isStepFragment = (text: string) => /^\s*\d{1,2}[.)]\s/.test(text) || /:\s*\d{1,2}[.)]\s/.test(text);
    const factual = sentences.filter(
      (s) => wordCount(s.text) >= 9 && wordCount(s.text) <= 40 && !isStepFragment(s.text),
    );
    // Questões de "afirmação correta" nascem de interpretação: elas
    // complementam, mas não podem dominar a prova.
    const statementLimit = Math.max(2, Math.round(wanted * 0.5));
    let statementCount = 0;
    for (const sentence of factual) {
      if (out.length >= wanted || statementCount >= statementLimit) break;
      const mutations: string[] = [];
      const base = truncate(sentence.text, 150);
      for (let attempt = 0; attempt < 6 && mutations.length < 3; attempt += 1) {
        const candidate = mutateStatement(attempt === 0 ? sentence.text : mutations[mutations.length - 1] ?? sentence.text);
        if (!candidate) break;
        const mutated = truncate(candidate, 150);
        if (mutated !== base && !mutations.includes(mutated)) mutations.push(mutated);
      }
      if (mutations.length < 3) {
        // Sem variações plausíveis: usa outras frases do material como distratores.
        const others = factual.filter((s) => s !== sentence && similarity(s.text, sentence.text) < 0.3).slice(0, 3);
        if (others.length < 3) continue;
        mutations.push(...others.map((o) => truncate(o.text, 150)));
      }
      const hits = findTerms(sentence.text);
      statementCount += 1;
      out.push({
        stem: `Segundo o material, qual afirmação está correta?`,
        options: [base, mutations[0], mutations[1], mutations[2]],
        correctIndex: 0,
        explanation: `A frase correta é a que está no material: "${base}".`,
        difficulty: pickDifficulty(settings.questionDifficultyMix, out.length),
        type: hasMarker(sentence.text, RISK_MARKERS) ? "identificacao_risco" : "interpretacao",
        subject: hits[0] ? titleCaseTerm(hits[0].entry.term) : content.category,
        competencies: comps(hits[0]?.entry.competencies[0]),
        sourceRef: refFor(content, sentence.chunk, sentence.text, true),
        confidence: 0.55,
      });
    }

    return out.slice(0, wanted);
  }

  // -------------------------------------------------------------------
  // Jogos: reaproveita o que já foi extraído. Só sugere mecânica que o
  // material sustenta (sem passo a passo, não há jogo de sequência).
  // -------------------------------------------------------------------
  private buildGames(
    content: ContentItem,
    settings: AiSettings,
    questions: SuggestedQuestion[],
    procedures: DetectedProcedure[],
    risks: DetectedRisk[],
  ): SuggestedGame[] {
    const allowed = new Set<GameType>(settings.allowedGameTypes);
    const out: SuggestedGame[] = [];
    const limit = Math.max(1, settings.gamesPerContent);

    const diagnosisType: GameType = content.category === "manutencao" || /máquina|maquina|motor|mecanism/i.test(content.title)
      ? "salve_a_maquina"
      : "qual_e_o_defeito";

    const diagnosisSource = questions.filter((q) => q.type !== "sequencia_operacional").slice(0, 5);
    if (allowed.has(diagnosisType) && diagnosisSource.length >= 3) {
      out.push({
        type: diagnosisType,
        title: diagnosisType === "salve_a_maquina" ? `Salve a máquina — ${content.title}` : `Qual é o defeito? — ${content.title}`,
        pitch: "Situação na tela, causa na mão: escolha certo e ganhe XP.",
        reason: `${diagnosisSource.length} situações derivadas dos trechos do material.`,
        sourceRefs: diagnosisSource.map((q) => q.sourceRef),
        payload: {
          kind: "diagnosis",
          rounds: diagnosisSource.map((q, i) => ({
            id: `R${i + 1}`,
            situation: q.stem,
            options: q.options.map((label, idx) => ({ id: `O${idx + 1}`, label })),
            correctOptionId: `O${q.correctIndex + 1}`,
            explanation: q.explanation,
            sourceId: q.sourceRef.sourceId,
          })),
        },
      });
    }

    if (allowed.has("monte_a_peca") && procedures.length > 0 && out.length < limit) {
      const usable = procedures.filter((p) => p.steps.length >= 3 && p.steps.length <= 10);
      if (usable.length > 0) {
        out.push({
          type: "monte_a_peca",
          title: `Coloque na ordem — ${truncate(usable[0].title, 50)}`,
          pitch: "Arraste as etapas até a sequência ficar correta.",
          reason: "Procedimento numerado encontrado no material.",
          sourceRefs: usable.map((p) => p.sourceRef),
          payload: {
            kind: "sequence",
            rounds: usable.slice(0, 2).map((p, i) => ({
              id: `S${i + 1}`,
              instruction: `Coloque na ordem correta: ${truncate(p.title, 80)}`,
              items: p.steps.map((step, idx) => ({ id: `i${idx + 1}`, label: truncate(step, 90), correctOrder: idx + 1 })),
              explanation: "Esta é a ordem registrada no procedimento do material.",
              sourceId: p.sourceRef.sourceId,
            })),
          },
        });
      }
    }

    if (allowed.has("desafio_60s") && questions.length >= 5 && out.length < limit) {
      out.push({
        type: "desafio_60s",
        title: `Desafio dos 60 segundos — ${truncate(content.title, 40)}`,
        pitch: "Quantas você acerta em um minuto?",
        reason: "Usa as questões aprovadas deste material.",
        sourceRefs: questions.slice(0, 3).map((q) => q.sourceRef),
        payload: {
          kind: "timed_quiz",
          rounds: [{
            id: "T1",
            seconds: 60,
            questionIds: [],
            inlineQuestions: questions.slice(0, 10).map((q, i) => ({
              id: `Q${i + 1}`,
              stem: q.stem,
              options: q.options,
              correctIndex: q.correctIndex,
              explanation: q.explanation,
              sourceId: q.sourceRef.sourceId,
            })),
          }],
        },
      });
    }

    if (risks.length >= 3 && out.length < limit && allowed.has("qual_e_o_defeito") && !out.some((g) => g.type === "qual_e_o_defeito")) {
      // Riscos viram rodadas de identificação (conduta x situação).
      out.push({
        type: "qual_e_o_defeito",
        title: `Identifique o risco — ${truncate(content.title, 40)}`,
        pitch: "Leia a situação e diga o que está errado.",
        reason: `${risks.length} trechos sobre risco/segurança encontrados.`,
        sourceRefs: risks.slice(0, 3).map((r) => r.sourceRef),
        payload: {
          kind: "diagnosis",
          rounds: risks.slice(0, 4).map((r, i) => ({
            id: `RK${i + 1}`,
            situation: `O material alerta: "${truncate(r.description, 160)}". Qual é a leitura correta dessa situação?`,
            options: [
              { id: "O1", label: "É uma situação de risco e exige ação imediata" },
              { id: "O2", label: "É apenas uma recomendação opcional" },
              { id: "O3", label: "Só vale para quem trabalha na manutenção" },
              { id: "O4", label: "Pode ser tratada no fim do turno" },
            ],
            correctOptionId: "O1",
            explanation: `Trecho de origem: "${truncate(r.description, 200)}".`,
            sourceId: r.sourceRef.sourceId,
          })),
        },
      });
    }

    return out.slice(0, limit);
  }

  // -------------------------------------------------------------------
  // Desafios: frases prescritivas do material ("deve", "nunca", "pare")
  // viram situação + conduta. Sempre marcados como incertos, porque o
  // enquadramento é interpretação — revisão humana obrigatória.
  // -------------------------------------------------------------------
  private buildChallenges(
    content: ContentItem,
    settings: AiSettings,
    sentences: Sentence[],
    risks: DetectedRisk[],
  ): SuggestedChallenge[] {
    const limit = Math.max(0, settings.challengesPerContent);
    if (limit === 0) return [];
    const prescriptive = sentences.filter((s) =>
      /\b(deve|devem|nunca|sempre|pare|obrigat[óo]ri|proibid|precisa|exige)\b/i.test(s.text) && wordCount(s.text) >= 8);
    const out: SuggestedChallenge[] = [];
    for (const sentence of prescriptive) {
      if (out.length >= limit) break;
      const correct = truncate(sentence.text, 160);
      const wrong: string[] = [];
      for (let i = 0; i < 5 && wrong.length < 3; i += 1) {
        const mutated = mutateStatement(wrong[wrong.length - 1] ?? sentence.text);
        if (!mutated) break;
        const candidate = truncate(mutated, 160);
        if (candidate !== correct && !wrong.includes(candidate)) wrong.push(candidate);
      }
      if (wrong.length < 3) continue;
      const hits = findTerms(sentence.text);
      out.push({
        title: hits[0] ? `Decisão: ${titleCaseTerm(hits[0].entry.term)}` : `Decisão no posto`,
        scenario: `No seu posto, a situação envolve ${hits[0] ? titleCaseTerm(hits[0].entry.term).toLowerCase() : content.category}. Qual conduta está de acordo com o material "${content.title}"?`,
        options: [correct, wrong[0], wrong[1], wrong[2]],
        correctIndex: 0,
        explanation: `Conforme o material: "${correct}".`,
        character: content.category === "seguranca" || risks.length > 2 ? "seguranca" : "mestre",
        sourceRef: refFor(content, sentence.chunk, sentence.text, true),
      });
    }
    return out;
  }
}

export const heuristicAnalyzer = new HeuristicAnalyzer();
