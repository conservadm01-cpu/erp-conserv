import type {
  Certificate, ChallengeAttempt, CompetencyLevel, EmployeeBadge, EmployeeCompetency, Enrollment, GameSession,
  ID, LessonProgress, Notification, QuizAttempt, RiskReport, XpTransaction,
} from "../../core/types";
import { COURSE_1 } from "./course1";
import { COURSE_5S, COURSE_NR1, COURSE_QUALIDADE } from "./courses2";
import { SEED_QUESTIONS } from "./questions";
import { daysAgoIso } from "../../core/dates";

// =====================================================================
// DADOS DE DEMONSTRAÇÃO
// ---------------------------------------------------------------------
// Histórico plausível para a plataforma abrir com vida: matrículas,
// aulas concluídas, tentativas de quiz, XP, badges, competências,
// certificado, riscos reportados e notificações.
//
// Tudo aqui é DADO de exemplo: some com "Restaurar demonstração" no
// painel administrativo e é recriado pelo mesmo caminho.
// =====================================================================

const xp: XpTransaction[] = [];
const progress: LessonProgress[] = [];
const enrollments: Enrollment[] = [];
const attempts: QuizAttempt[] = [];
const gameSessions: GameSession[] = [];
const challengeAttempts: ChallengeAttempt[] = [];
const competencies: EmployeeCompetency[] = [];
const badges: EmployeeBadge[] = [];
const certificates: Certificate[] = [];
const risks: RiskReport[] = [];
const notifications: Notification[] = [];

let seq = 0;
const nid = (prefix: string) => `${prefix}-DEMO-${String((seq += 1)).padStart(4, "0")}`;

function addXp(employeeId: ID, amount: number, reason: string, refType: XpTransaction["refType"], refId: ID, daysAgo: number) {
  xp.push({ id: nid("XP"), employeeId, amount, reason, refType, refId, at: daysAgoIso(daysAgo) });
}

function completeLessons(employeeId: ID, courseId: ID, lessonIds: ID[], startDaysAgo: number) {
  lessonIds.forEach((lessonId, index) => {
    const daysAgo = Math.max(0, startDaysAgo - index * 2);
    progress.push({
      id: nid("PRG"),
      employeeId,
      courseId,
      lessonId,
      status: "concluido",
      timeSpentSec: 420 + index * 45,
      startedAt: daysAgoIso(daysAgo + 1),
      completedAt: daysAgoIso(daysAgo),
    });
    addXp(employeeId, 20, "Aula concluída", "aula", lessonId, daysAgo);
  });
}

function enroll(
  employeeId: ID,
  courseId: ID,
  lessonsTotal: number,
  lessonsDone: number,
  status: Enrollment["status"],
  startDaysAgo: number,
  finalScore?: number,
  certificateId?: ID,
): Enrollment {
  const enrollment: Enrollment = {
    id: nid("ENR"),
    employeeId,
    courseId,
    status,
    progressPct: lessonsTotal === 0 ? 0 : Math.round((lessonsDone / lessonsTotal) * 100),
    lessonsDone,
    lessonsTotal,
    startedAt: daysAgoIso(startDaysAgo),
    lastActivityAt: daysAgoIso(Math.max(0, startDaysAgo - lessonsDone * 2)),
    completedAt: status === "concluido" ? daysAgoIso(Math.max(0, startDaysAgo - lessonsDone * 2)) : undefined,
    finalScore,
    certificateId,
    source: status === "concluido" ? "obrigatorio" : "autoinscricao",
  };
  enrollments.push(enrollment);
  return enrollment;
}

function quizAttempt(employeeId: ID, quizId: ID, courseId: ID | undefined, questionIds: ID[], correctRatio: number, daysAgo: number, xpEarned: number): QuizAttempt {
  const answers = questionIds.map((questionId, index) => {
    const question = SEED_QUESTIONS.find((q) => q.id === questionId);
    const correct = index / questionIds.length < correctRatio;
    return {
      questionId,
      optionId: correct
        ? question?.correctOptionId ?? null
        : question?.options.find((o) => o.id !== question.correctOptionId)?.id ?? null,
      correct,
      timeSec: 18 + (index % 5) * 6,
      competencies: question?.competencies ?? [],
      subject: question?.subject ?? "—",
    };
  });
  const score = Math.round((answers.filter((a) => a.correct).length / answers.length) * 100);
  const attempt: QuizAttempt = {
    id: nid("QAT"),
    quizId,
    employeeId,
    courseId,
    answers,
    score,
    passed: score >= 70,
    startedAt: daysAgoIso(daysAgo),
    finishedAt: daysAgoIso(daysAgo),
    durationSec: answers.length * 24,
    xpEarned,
  };
  attempts.push(attempt);
  addXp(employeeId, xpEarned, `Quiz (${score}%)`, "quiz", quizId, daysAgo);
  return attempt;
}

function competency(employeeId: ID, competencyId: ID, level: CompetencyLevel, score: number, evidenceLabel: string, daysAgo = 5): EmployeeCompetency {
  const entry: EmployeeCompetency = {
    id: nid("ECP"),
    employeeId,
    competencyId,
    level,
    score,
    evidence: [{ kind: "curso", refId: "CRS-001", label: evidenceLabel, weight: score, at: daysAgoIso(daysAgo) }],
    assessedAt: daysAgoIso(daysAgo),
  };
  competencies.push(entry);
  return entry;
}

// ---------------------------------------------------------------------
// MARIA (EMP-0001) — costureira qualificada, exemplo da seção 14:
// domina reta em nível 5 e overloque apenas em nível 2.
// ---------------------------------------------------------------------
const course1Lessons = COURSE_1.lessons.map((l) => l.id);
completeLessons("EMP-0001", "CRS-001", course1Lessons.slice(0, 7), 40);
enroll("EMP-0001", "CRS-001", course1Lessons.length, 7, "em_andamento", 45);

const lessons5s = COURSE_5S.lessons.map((l) => l.id);
completeLessons("EMP-0001", "CRS-005", lessons5s, 22);
const CERT_MARIA = "CSV-7K2M-QX84";
enroll("EMP-0001", "CRS-005", lessons5s.length, lessons5s.length, "concluido", 25, 85, `CERT-${CERT_MARIA}`);
quizAttempt("EMP-0001", "QIZ-CRS-005", "CRS-005", SEED_QUESTIONS.filter((q) => q.courseId === "CRS-005").map((q) => q.id), 0.85, 20, 60);
addXp("EMP-0001", 500, "Curso concluído: 5S no Posto de Trabalho", "curso", "CRS-005", 20);
addXp("EMP-0001", 1000, "Certificado emitido: 5S no Posto de Trabalho", "certificado", `CERT-${CERT_MARIA}`, 20);

const lessonsNr1 = COURSE_NR1.lessons.map((l) => l.id);
completeLessons("EMP-0001", "CRS-002", lessonsNr1.slice(0, 1), 6);
enroll("EMP-0001", "CRS-002", lessonsNr1.length, 1, "em_andamento", 7);

// Quiz da aula de regulagem com desempenho fraco → gera recomendação de
// reforço no dashboard (aprendizado adaptativo).
quizAttempt(
  "EMP-0001",
  "QIZ-LES-REG",
  "CRS-001",
  SEED_QUESTIONS.filter((q) => q.subject === "Regulagem da overloque").slice(0, 5).map((q) => q.id),
  0.4,
  3,
  28,
);

gameSessions.push({
  id: nid("GSS"),
  gameId: "GAM-000001",
  employeeId: "EMP-0001",
  score: 4,
  maxScore: 5,
  passed: true,
  startedAt: daysAgoIso(4),
  finishedAt: daysAgoIso(4),
  durationSec: 186,
  xpEarned: 84,
  details: [
    { roundId: "R1", correct: true, competencies: ["CMP-REGULAGEM"] },
    { roundId: "R2", correct: true, competencies: ["CMP-AGULHA-LINHA"] },
    { roundId: "R3", correct: true, competencies: ["CMP-REGULAGEM"] },
    { roundId: "R4", correct: false, competencies: ["CMP-OVERLOQUE"] },
    { roundId: "R5", correct: true, competencies: ["CMP-REGULAGEM"] },
  ],
});
addXp("EMP-0001", 84, "Jogo: Qual é o defeito? (80%)", "jogo", "GAM-000001", 4);

["CHL-000001", "CHL-000004", "CHL-000005"].forEach((challengeId, index) => {
  challengeAttempts.push({
    id: nid("CAT"),
    challengeId,
    employeeId: "EMP-0001",
    optionId: `${challengeId}-O1`,
    correct: index !== 2,
    at: daysAgoIso(index + 1),
    xpEarned: index !== 2 ? 100 : 0,
    daily: true,
  });
  if (index !== 2) addXp("EMP-0001", 100, "Desafio do dia", "desafio", challengeId, index + 1);
});

competency("EMP-0001", "CMP-RETA", 5, 86, "Experiência + avaliação do supervisor", 30);
competency("EMP-0001", "CMP-OVERLOQUE", 2, 22, "Aulas iniciais de overloque", 10);
competency("EMP-0001", "CMP-GALONEIRA", 3, 44, "Operação no dia a dia", 30);
competency("EMP-0001", "CMP-REGULAGEM", 2, 24, "Aula de regulagem + quiz", 3);
competency("EMP-0001", "CMP-AGULHA-LINHA", 3, 48, "Aula de agulhas e linhas", 25);
competency("EMP-0001", "CMP-QUALIDADE", 3, 52, "Autocontrole na linha", 20);
competency("EMP-0001", "CMP-SEQ-OPERACIONAL", 3, 40, "Sequência da camiseta básica", 25);
competency("EMP-0001", "CMP-FICHA-TECNICA", 2, 30, "Leitura de ficha técnica", 25);
competency("EMP-0001", "CMP-5S", 4, 70, "Curso 5S concluído", 20);
competency("EMP-0001", "CMP-ERGONOMIA", 2, 20, "Aula de ergonomia", 7);
competency("EMP-0001", "CMP-NR1", 2, 18, "Curso NR-1 em andamento", 6);
competency("EMP-0001", "CMP-PRODUTIVIDADE", 3, 38, "Aula de produtividade", 24);
competency("EMP-0001", "CMP-MANUTENCAO", 1, 12, "Limpeza de máquina no fim do turno", 24);

badges.push(
  { id: nid("EBG"), employeeId: "EMP-0001", badgeId: "BDG-01", earnedAt: daysAgoIso(20), context: "Curso 5S no Posto de Trabalho" },
  { id: nid("EBG"), employeeId: "EMP-0001", badgeId: "BDG-02", earnedAt: daysAgoIso(30), context: "Nível 5 em Máquina Reta" },
  { id: nid("EBG"), employeeId: "EMP-0001", badgeId: "BDG-07", earnedAt: daysAgoIso(20), context: "Trilha 5S e Organização" },
);
addXp("EMP-0001", 100, "Badge conquistado: Primeiro Curso", "curso", "BDG-01", 20);
addXp("EMP-0001", 300, "Badge conquistado: Mestre da Costura", "curso", "BDG-02", 30);
addXp("EMP-0001", 150, "Badge conquistado: 5S", "curso", "BDG-07", 20);

certificates.push({
  id: `CERT-${CERT_MARIA}`,
  code: CERT_MARIA,
  kind: "curso",
  refId: "CRS-005",
  employeeId: "EMP-0001",
  employeeName: "Maria Aparecida Silva",
  employeeCode: "0142",
  title: "5S no Posto de Trabalho",
  hours: 3,
  score: 85,
  issuedAt: daysAgoIso(20),
  responsible: "Coordenação de Treinamento — ConServ Confecções",
  classification: "Certificado de conclusão de treinamento interno",
  status: "valido",
  validationPath: `/validar-certificado/${CERT_MARIA}`,
  competencies: ["CMP-5S", "CMP-PRODUTIVIDADE", "CMP-ERGONOMIA", "CMP-CULTURA"],
  librarySourceIds: ["SRCLIB-CONSERV-POP", "SRCLIB-MTE-NR17"],
});

// ---------------------------------------------------------------------
// Outros colaboradores — histórico mais leve, para os relatórios e o
// painel do gestor terem conteúdo real.
// ---------------------------------------------------------------------
const lessonsQual = COURSE_QUALIDADE.lessons.map((l) => l.id);

// Joana (aprendiz recente, começando a trilha de costura)
completeLessons("EMP-0002", "CRS-001", course1Lessons.slice(0, 3), 10);
enroll("EMP-0002", "CRS-001", course1Lessons.length, 3, "em_andamento", 12);
competency("EMP-0002", "CMP-RETA", 2, 20, "Início da formação", 10);
competency("EMP-0002", "CMP-OVERLOQUE", 1, 8, "Conhecimento inicial", 10);
competency("EMP-0002", "CMP-QUALIDADE", 1, 10, "Aulas iniciais", 10);
challengeAttempts.push({ id: nid("CAT"), challengeId: "CHL-000003", employeeId: "EMP-0002", optionId: "CHL-000003-O1", correct: true, at: daysAgoIso(2), xpEarned: 100, daily: true });
addXp("EMP-0002", 100, "Desafio do dia", "desafio", "CHL-000003", 2);

// Antônio (cortador especialista, concluiu corte)
const lessonsCorte = ["LES-CORTE-INT-01", "LES-CORTE-INT-02", "LES-CORTE-INT-03"];
completeLessons("EMP-0003", "CRS-004", lessonsCorte, 18);
enroll("EMP-0003", "CRS-004", 3, 3, "concluido", 20, 92, "CERT-CSV-3H8P-LM27");
quizAttempt("EMP-0003", "QIZ-CRS-004", "CRS-004", SEED_QUESTIONS.filter((q) => q.courseId === "CRS-004").map((q) => q.id), 0.92, 16, 70);
addXp("EMP-0003", 500, "Curso concluído: Corte Inteligente", "curso", "CRS-004", 16);
addXp("EMP-0003", 1000, "Certificado emitido: Corte Inteligente", "certificado", "CERT-CSV-3H8P-LM27", 16);
competency("EMP-0003", "CMP-ENFESTO", 5, 88, "Experiência + curso de corte", 16);
competency("EMP-0003", "CMP-RISCO-ENCAIXE", 5, 84, "Experiência + curso de corte", 16);
competency("EMP-0003", "CMP-CORTE-MAQUINA", 5, 86, "Experiência", 16);
competency("EMP-0003", "CMP-APROVEITAMENTO", 4, 68, "Controle de aproveitamento", 16);
competency("EMP-0003", "CMP-NR1", 3, 40, "Treinamento de segurança", 16);
badges.push({ id: nid("EBG"), employeeId: "EMP-0003", badgeId: "BDG-01", earnedAt: daysAgoIso(16), context: "Curso Corte Inteligente" });
certificates.push({
  id: "CERT-CSV-3H8P-LM27",
  code: "CSV-3H8P-LM27",
  kind: "curso",
  refId: "CRS-004",
  employeeId: "EMP-0003",
  employeeName: "Antônio Carlos Pereira",
  employeeCode: "0093",
  title: "Corte Inteligente — Enfesto, Risco e Aproveitamento",
  hours: 5,
  score: 92,
  issuedAt: daysAgoIso(16),
  responsible: "Coordenação de Treinamento — ConServ Confecções",
  classification: "Certificado de conclusão de treinamento interno",
  status: "valido",
  validationPath: "/validar-certificado/CSV-3H8P-LM27",
  competencies: ["CMP-ENFESTO", "CMP-RISCO-ENCAIXE", "CMP-CORTE-MAQUINA", "CMP-APROVEITAMENTO"],
  librarySourceIds: ["SRCLIB-CONSERV-POP", "SRCLIB-SENAI-VEST", "SRCLIB-MTE-NR12"],
});

// Rafael (revisor, qualidade em andamento)
completeLessons("EMP-0005", "CRS-003", lessonsQual.slice(0, 2), 8);
enroll("EMP-0005", "CRS-003", lessonsQual.length, 2, "em_andamento", 9);
competency("EMP-0005", "CMP-QUALIDADE", 4, 72, "Revisão diária + curso", 8);
competency("EMP-0005", "CMP-DEFEITOS", 4, 66, "Análise de defeitos", 8);
competency("EMP-0005", "CMP-RETRABALHO", 3, 46, "Acompanhamento de retrabalho", 8);
gameSessions.push({
  id: nid("GSS"), gameId: "GAM-000005", employeeId: "EMP-0005", score: 7, maxScore: 7, passed: true,
  startedAt: daysAgoIso(5), finishedAt: daysAgoIso(5), durationSec: 240, xpEarned: 120,
  details: [{ roundId: "Q1", correct: true, competencies: ["CMP-QUALIDADE"] }, { roundId: "Q2", correct: true, competencies: ["CMP-DEFEITOS"] }],
});
addXp("EMP-0005", 120, "Jogo: Mestre da Qualidade (100%)", "jogo", "GAM-000005", 5);
badges.push({ id: nid("EBG"), employeeId: "EMP-0005", badgeId: "BDG-03", earnedAt: daysAgoIso(5), context: "Partida perfeita em Mestre da Qualidade" });

// Luciana (estamparia), Cleide (embalagem), Sebastião (manutenção)
completeLessons("EMP-0004", "CRS-002", lessonsNr1.slice(0, 2), 12);
enroll("EMP-0004", "CRS-002", lessonsNr1.length, 2, "em_andamento", 14);
competency("EMP-0004", "CMP-SILK-TELA", 3, 50, "Operação diária", 14);
competency("EMP-0004", "CMP-SILK-IMPRESSAO", 3, 48, "Operação diária", 14);
competency("EMP-0004", "CMP-NR1", 2, 22, "Curso NR-1 em andamento", 12);

completeLessons("EMP-0006", "CRS-005", lessons5s.slice(0, 2), 9);
enroll("EMP-0006", "CRS-005", lessons5s.length, 2, "em_andamento", 10);
competency("EMP-0006", "CMP-EMBALAGEM", 3, 50, "Operação diária", 10);
competency("EMP-0006", "CMP-5S", 2, 26, "Curso em andamento", 9);

completeLessons("EMP-0007", "CRS-001", course1Lessons, 30);
enroll("EMP-0007", "CRS-001", course1Lessons.length, course1Lessons.length, "concluido", 34, 96, undefined);
quizAttempt("EMP-0007", "QIZ-CRS-001", "CRS-001", SEED_QUESTIONS.filter((q) => q.courseId === "CRS-001").slice(0, 12).map((q) => q.id), 0.95, 28, 140);
addXp("EMP-0007", 500, "Curso concluído: Costureira Profissional — Fundamentos", "curso", "CRS-001", 28);
competency("EMP-0007", "CMP-REGULAGEM", 6, 98, "Mecânico de máquinas — referência da fábrica", 28);
competency("EMP-0007", "CMP-MANUTENCAO", 5, 90, "Manutenção preventiva e corretiva", 28);
competency("EMP-0007", "CMP-AGULHA-LINHA", 4, 70, "Treinamento de operadores", 28);
competency("EMP-0007", "CMP-NR1", 4, 64, "Segurança em máquinas", 28);
badges.push(
  { id: nid("EBG"), employeeId: "EMP-0007", badgeId: "BDG-06", earnedAt: daysAgoIso(28), context: "Nível 6 em Regulagem" },
  { id: nid("EBG"), employeeId: "EMP-0007", badgeId: "BDG-01", earnedAt: daysAgoIso(28), context: "Curso de Fundamentos" },
);

// ---------------------------------------------------------------------
// "Eu vi um risco" — dois registros em estágios diferentes
// ---------------------------------------------------------------------
risks.push(
  {
    id: nid("RSK"),
    code: "RSK-2026-0001",
    employeeId: "EMP-0002",
    employeeName: "Joana Ribeiro dos Santos",
    anonymous: false,
    sector: "Costura",
    place: "Corredor entre as linhas 2 e 3",
    category: "Queda / obstrução",
    description: "Caixas de peça pronta ficam no corredor durante o turno da tarde, estreitando a passagem perto da saída.",
    priority: "alta",
    status: "acao_definida",
    createdAt: daysAgoIso(6),
    timeline: [
      { at: daysAgoIso(6), status: "aberto", note: "Registro feito pelo colaborador.", byId: "EMP-0002", byName: "Joana Ribeiro dos Santos" },
      { at: daysAgoIso(5), status: "em_analise", note: "Verificado no local: fluxo de retirada acumula caixas no fim da tarde.", byId: "EMP-0008", byName: "Patrícia Almeida Souza" },
      { at: daysAgoIso(4), status: "acao_definida", note: "Definido ponto de espera demarcado fora do corredor + retirada a cada hora.", byId: "EMP-0008", byName: "Patrícia Almeida Souza" },
    ],
    actionPlan: { what: "Demarcar ponto de espera e ajustar frequência de retirada", who: "Supervisão de Produção", when: daysAgoIso(-3), done: false },
  },
  {
    id: nid("RSK"),
    code: "RSK-2026-0002",
    anonymous: true,
    sector: "Estamparia",
    place: "Bancada de recuperação de telas",
    category: "Produto químico",
    description: "Produto de recuperação de tela sendo usado sem ventilação suficiente no fim do turno.",
    priority: "critica",
    status: "resolvido",
    createdAt: daysAgoIso(14),
    timeline: [
      { at: daysAgoIso(14), status: "aberto", note: "Registro anônimo." },
      { at: daysAgoIso(13), status: "em_analise", note: "SESMT avaliou o posto e a ficha de segurança do produto.", byId: "EMP-0009", byName: "Coordenação de Treinamento ConServ" },
      { at: daysAgoIso(11), status: "acao_definida", note: "Exaustor reposicionado e procedimento revisado com a equipe.", byId: "EMP-0009", byName: "Coordenação de Treinamento ConServ" },
      { at: daysAgoIso(8), status: "resolvido", note: "Verificação no local confirmou ventilação adequada e uso de EPI.", byId: "EMP-0008", byName: "Patrícia Almeida Souza" },
    ],
    closedAt: daysAgoIso(8),
  },
);

// ---------------------------------------------------------------------
// Notificações
// ---------------------------------------------------------------------
notifications.push(
  {
    id: nid("NTF"), employeeId: "EMP-0001", title: "Seu certificado está pronto",
    body: "Certificado de 5S no Posto de Trabalho disponível (código CSV-7K2M-QX84).",
    kind: "conquista", link: "/certificados", read: false, createdAt: daysAgoIso(20),
  },
  {
    id: nid("NTF"), employeeId: "EMP-0001", title: "Recomendação de reforço",
    body: "Seu desempenho em Regulagem da overloque ficou em 40%. Preparamos um reforço rápido.",
    kind: "recomendacao", link: "/trilhas", read: false, createdAt: daysAgoIso(3),
  },
  {
    id: nid("NTF"), role: "GESTOR", title: "Risco aguardando ação",
    body: "RSK-2026-0001 (Costura) está com plano de ação definido e prazo próximo.",
    kind: "risco", link: "/admin/riscos", read: false, createdAt: daysAgoIso(4),
  },
);

export const SEED_DEMO = {
  enrollments,
  progress,
  attempts,
  gameSessions,
  challengeAttempts,
  competencies,
  badges,
  certificates,
  risks,
  notifications,
  xp,
};
