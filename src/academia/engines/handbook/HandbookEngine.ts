// =====================================================================
// GERADOR DE APOSTILAS (seção 12)
// ---------------------------------------------------------------------
// Monta a apostila na estrutura pedida: capa, sumário, objetivos,
// módulos, conteúdo, imagens, exemplos, curiosidades, atividades,
// desafios, quiz, avaliação, gabarito, referências e conclusão.
//
// Toda apostila carrega REFERENCES (seção 24): as fontes dos materiais
// que a originaram. A impressão/PDF é feita pelo navegador (print),
// então não depende de serviço externo.
// =====================================================================

import type {
  Handbook, HandbookSection, ID, LessonBlock, Question,
} from "../../core/types";
import { catalogRepo, settingsRepo } from "../../data/repositories";
import { seqId, uid } from "../../core/ids";
import { formatDate, nowIso } from "../../core/dates";

export interface HandbookInput {
  courseId?: ID;
  contentIds?: ID[];
  title?: string;
  subtitle?: string;
  hours?: number;
  author: string;
  version?: string;
  objectives?: string[];
  includeAnswerKey?: boolean;
  createdBy: ID;
  status?: Handbook["status"];
}

let sectionSeq = 0;
function section(kind: HandbookSection["kind"], title: string, blocks: LessonBlock[], questionIds?: ID[]): HandbookSection {
  sectionSeq += 1;
  return { id: `HBS-${sectionSeq}-${Math.random().toString(36).slice(2, 6)}`, kind, title, blocks, questionIds, order: sectionSeq };
}

function questionBlocks(questions: Question[], withAnswers: boolean): LessonBlock[] {
  return questions.map((question, index) => ({
    kind: "list" as const,
    ordered: false,
    items: [
      `${index + 1}. ${question.stem}`,
      ...question.options.map((o, i) => `${String.fromCharCode(97 + i)}) ${o.text}`),
      ...(withAnswers
        ? [`Resposta: ${String.fromCharCode(97 + question.options.findIndex((o) => o.id === question.correctOptionId))}) — ${question.explanation}`]
        : []),
    ],
    sourceId: question.sourceRef.sourceId,
  }));
}

export const handbookEngine = {
  generate(input: HandbookInput): Handbook {
    sectionSeq = 0;
    const settings = settingsRepo.get();
    const course = input.courseId ? catalogRepo.course(input.courseId) : undefined;
    const contentIds = input.contentIds ?? course?.sourceContentIds ?? [];
    const contents = contentIds.map((id) => catalogRepo.content(id)).filter((c): c is NonNullable<typeof c> => !!c);
    const lessons = course ? catalogRepo.orderedLessons(course.id) : [];
    const modules = course ? catalogRepo.modulesOf(course.id) : [];
    const title = input.title ?? course?.title ?? contents[0]?.title ?? "Apostila ConServ";
    const hours = input.hours ?? course?.hours ?? Math.max(1, Math.round(lessons.reduce((s, l) => s + l.durationMin, 0) / 60));
    const competencyIds = course?.competencies ?? contents.flatMap((c) => c.competencies);

    const curiosities = catalogRepo.publishedCuriosities()
      .filter((c) => c.competencies.some((id) => competencyIds.includes(id)) || contentIds.includes(c.sourceRef.contentId))
      .slice(0, 8);
    const challenges = catalogRepo.publishedChallenges()
      .filter((c) => (course && c.courseId === course.id) || contentIds.includes(c.sourceRef.contentId))
      .slice(0, 6);
    const quiz = course?.finalQuizId ? catalogRepo.quiz(course.finalQuizId) : undefined;
    const questions = (quiz?.questionIds ?? [])
      .map((id) => catalogRepo.question(id))
      .filter((q): q is Question => !!q);
    const practiceQuestions = questions.filter((q) => q.type === "situacao_pratica" || q.type === "solucao_problema" || q.type === "sequencia_operacional");
    const examQuestions = questions.slice(0, 10);

    const sections: HandbookSection[] = [];

    // CAPA
    sections.push(section("capa", title, [
      { kind: "heading", text: title },
      { kind: "text", text: input.subtitle ?? course?.subtitle ?? "Material de treinamento interno — ConServ Confecções" },
      {
        kind: "table",
        headers: ["Item", "Informação"],
        rows: [
          ["Curso", course?.title ?? title],
          ["Versão", input.version ?? "1.0"],
          ["Carga horária", `${hours} hora(s)`],
          ["Autor / responsável", input.author],
          ["Data", formatDate(nowIso())],
          ["Classificação", settings.certificateClassification],
        ],
      },
      { kind: "callout", tone: "info", title: "Aviso", text: settings.legalDisclaimer },
    ]));

    // SUMÁRIO
    const summaryItems = [
      "Objetivos de aprendizagem",
      ...modules.map((m, i) => `Módulo ${i + 1} — ${m.title.replace(/^\d+\.\s*/, "")}`),
      "Conteúdo técnico",
      "Exemplos práticos",
      "Curiosidades",
      "Atividades",
      "Desafios",
      "Quiz",
      "Avaliação",
      ...(input.includeAnswerKey === false ? [] : ["Gabarito"]),
      "Referências",
      "Conclusão",
    ];
    sections.push(section("sumario", "Sumário", [{ kind: "list", ordered: true, items: summaryItems }]));

    // OBJETIVOS
    const objectives = input.objectives ?? [
      `Compreender os conceitos fundamentais de ${course?.category ?? contents[0]?.category ?? "processo"}.`,
      "Reconhecer e aplicar o padrão da ConServ no dia a dia do posto.",
      "Identificar defeitos, riscos e desperdícios antes que eles se repitam.",
      "Saber quando resolver e quando parar e pedir apoio.",
    ];
    sections.push(section("objetivos", "Objetivos de aprendizagem", [{ kind: "list", items: objectives }]));

    // MÓDULOS + CONTEÚDO
    for (const module of modules) {
      const moduleLessons = catalogRepo.lessonsOfModule(module.id);
      sections.push(section("modulo", module.title, [
        { kind: "text", text: module.summary },
        { kind: "list", items: moduleLessons.map((l) => `${l.title} — ${l.durationMin} min`) },
      ]));
      for (const lesson of moduleLessons) {
        sections.push(section("conteudo", lesson.title, lesson.blocks));
      }
    }
    if (modules.length === 0) {
      for (const content of contents) {
        sections.push(section("conteudo", content.title,
          content.chunks.map((chunk) => ({ kind: "text" as const, text: chunk.text, sourceId: chunk.sourceId }))));
      }
    }

    // IMAGENS
    const images: LessonBlock[] = lessons.flatMap((l) => l.blocks.filter((b) => b.kind === "image"));
    sections.push(section("imagens", "Imagens e ilustrações", images.length > 0 ? images : [
      { kind: "callout", tone: "dica", title: "Espaço para imagens", text: "Inclua aqui fotos do posto, da peça e dos defeitos reais. Imagem da própria fábrica ensina mais rápido que desenho genérico." },
    ]));

    // EXEMPLOS
    const examples = contents.flatMap((c) => c.analysis?.examples ?? []).slice(0, 6);
    sections.push(section("exemplos", "Exemplos práticos", examples.length > 0
      ? examples.map((e) => ({ kind: "text" as const, text: e.text, sourceId: e.sourceRef.sourceId }))
      : [{ kind: "text", text: "Use os casos reais do seu setor registrados na última semana: eles são os melhores exemplos." }]));

    // CURIOSIDADES
    sections.push(section("curiosidades", "Curiosidades", curiosities.length > 0
      ? curiosities.map((c) => ({ kind: "callout" as const, tone: "dica" as const, title: c.title, text: c.text, sourceId: c.sourceRef.sourceId }))
      : [{ kind: "text", text: "Nenhuma curiosidade vinculada a este tema ainda." }]));

    // ATIVIDADES
    sections.push(section("atividades", "Atividades práticas", [
      {
        kind: "steps",
        title: "No seu posto",
        steps: [
          "Observe sua operação durante 15 minutos e anote quantas vezes você procura algo.",
          "Confira a primeira peça do próximo lote e registre medida, ponto e acabamento.",
          "Identifique um risco no seu posto e registre pelo botão “Eu vi um risco”.",
          "Apresente ao seu supervisor uma melhoria possível, com o motivo.",
        ],
      },
      ...(practiceQuestions.length > 0 ? questionBlocks(practiceQuestions.slice(0, 4), false) : []),
    ]));

    // DESAFIOS
    sections.push(section("desafios", "Desafios", challenges.length > 0
      ? challenges.map((c) => ({
          kind: "list" as const,
          items: [`${c.title}: ${c.scenario}`, ...c.options.map((o, i) => `${String.fromCharCode(97 + i)}) ${o.text}`)],
          sourceId: c.sourceRef.sourceId,
        }))
      : [{ kind: "text", text: "Nenhum desafio vinculado a este tema ainda." }]));

    // QUIZ
    sections.push(section("quiz", "Quiz de fixação",
      questions.length > 0 ? questionBlocks(questions.slice(0, 6), false) : [{ kind: "text", text: "Sem questões aprovadas para este tema." }],
      questions.slice(0, 6).map((q) => q.id)));

    // AVALIAÇÃO
    sections.push(section("avaliacao", "Avaliação",
      [
        { kind: "text", text: `Aproveitamento mínimo: ${course?.passScore ?? settings.defaultPassScore}%. ${quiz?.timeLimitSec ? `Tempo: ${Math.round(quiz.timeLimitSec / 60)} minutos.` : ""}` },
        ...questionBlocks(examQuestions, false),
      ],
      examQuestions.map((q) => q.id)));

    // GABARITO
    if (input.includeAnswerKey !== false) {
      sections.push(section("gabarito", "Gabarito", questionBlocks(examQuestions, true), examQuestions.map((q) => q.id)));
    }

    // REFERÊNCIAS
    const references = [
      ...new Set([
        ...(course?.librarySourceIds ?? []),
        ...contents.flatMap((c) => c.librarySourceIds),
      ]),
    ]
      .map((id) => catalogRepo.source(id))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => ({
        label: s.name,
        detail: `${s.institution} — ${s.type}${s.accessedAt ? ` (acesso em ${formatDate(s.accessedAt)})` : ""}`,
        url: s.url,
      }));
    const materialRefs = contents.map((c) => ({
      label: `${c.title} (${c.id} v${c.version})`,
      detail: `Material interno ConServ — ${c.source.type}${c.source.reference ? `: ${c.source.reference}` : ""}`,
      url: c.source.url,
    }));
    const allReferences = [...references, ...materialRefs];
    sections.push(section("referencias", "Referências", [
      { kind: "list", items: allReferences.map((r) => `${r.label} — ${r.detail}${r.url ? ` (${r.url})` : ""}`) },
      { kind: "callout", tone: "info", title: "Rastreabilidade", text: "Cada trecho técnico desta apostila tem um SOURCE_ID que aponta para o material de origem no Banco de Conhecimento ConServ." },
    ]));

    // CONCLUSÃO
    const conclusion = "Ninguém aprende um ofício só lendo. Este material vale pelo que você vai aplicar amanhã no seu posto: conferir a primeira peça, testar antes de produzir, avisar quando algo estiver diferente e cuidar da máquina que garante o trabalho de todos.";
    sections.push(section("conclusao", "Conclusão", [
      { kind: "text", text: conclusion },
      { kind: "character", character: "mestre", text: "Conhecimento que vira qualidade. É disso que a gente vive aqui." },
    ]));

    const handbook: Handbook = {
      id: seqId("HBK"),
      code: `APO-${uid("").slice(1, 7).toUpperCase()}`,
      title,
      subtitle: input.subtitle ?? course?.subtitle,
      courseId: course?.id,
      contentIds,
      version: input.version ?? "1.0",
      hours,
      author: input.author,
      date: nowIso(),
      objectives,
      sections,
      references: allReferences,
      conclusion,
      status: input.status ?? "draft",
      createdBy: input.createdBy,
      createdAt: nowIso(),
    };
    catalogRepo.saveHandbook(handbook);
    if (course) catalogRepo.patchCourse(course.id, { handbookId: handbook.id });
    for (const contentId of contentIds) {
      const content = catalogRepo.content(contentId);
      if (!content) continue;
      catalogRepo.patchContent(contentId, {
        generated: { ...content.generated, handbookIds: [...new Set([...content.generated.handbookIds, handbook.id])] },
      });
    }
    return handbook;
  },
};
