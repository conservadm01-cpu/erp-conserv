// =====================================================================
// ACADEMIA CONSERV — MODELO DE DOMÍNIO
// ---------------------------------------------------------------------
// Regra principal do projeto: CONTEÚDO É DADO, NÃO É CÓDIGO.
// Todas as entidades abaixo são gravadas no banco (ver data/db.ts) e
// podem ser criadas/editadas pelo painel administrativo sem que nenhuma
// linha deste repositório precise mudar.
//
// Cada informação técnica carrega um SOURCE_ID (ver SourceRef) apontando
// para o trecho do material de origem que a sustenta — é isso que dá
// rastreabilidade a aulas, questões, curiosidades, jogos e apostilas.
// =====================================================================

export type ID = string;
export type ISODate = string;

// ---------------------------------------------------------------------
// Rastreabilidade
// ---------------------------------------------------------------------

/**
 * SOURCE_ID — identifica exatamente de onde uma informação veio.
 * Formato canônico: `SRC:<contentId>#<chunkIndex>` (ver core/ids.ts).
 */
export type SourceId = string;

export interface SourceRef {
  sourceId: SourceId;
  contentId: ID;
  /** Trecho literal do material que sustenta a informação. */
  excerpt: string;
  /** Página/slide/seção quando o extrator conseguiu identificar. */
  locator?: string;
  /** Biblioteca de fontes (instituição/norma/fabricante), quando houver. */
  librarySourceId?: ID;
  /** true quando a informação foi inferida e precisa de conferência humana. */
  uncertain?: boolean;
}

// ---------------------------------------------------------------------
// Pessoas, acesso e permissões
// ---------------------------------------------------------------------

export type Role = "ADMIN" | "GESTOR" | "INSTRUTOR" | "COLABORADOR";

export interface User {
  id: ID;
  employeeId: ID;
  login: string;
  /** Hash simples (ver auth/password.ts). Ponto de troca por Supabase Auth. */
  passwordHash: string | null;
  role: Role;
  active: boolean;
  createdAt: ISODate;
  lastLoginAt?: ISODate;
}

export interface Department {
  id: ID;
  code: string;
  name: string;
  description?: string;
}

export interface JobRole {
  id: ID;
  name: string;
  departmentId: ID;
  description?: string;
  /** Competências esperadas da função e o nível alvo (1..6). */
  targets: Array<{ competencyId: ID; level: CompetencyLevel }>;
}

export type ProfessionalLevel =
  | "aprendiz"
  | "iniciante"
  | "operacional"
  | "qualificado"
  | "avancado"
  | "especialista";

export interface Employee {
  id: ID;
  /** Matrícula. */
  code: string;
  name: string;
  departmentId: ID;
  jobRoleId: ID;
  cargo: string;
  admissionDate: ISODate;
  supervisorId?: ID;
  professionalLevel: ProfessionalLevel;
  photoUrl?: string;
  /** Iniciais usadas quando não há foto. */
  initials?: string;
  shift?: "manha" | "tarde" | "integral" | "noite";
  status: "ativo" | "afastado" | "inativo";
  /**
   * Privacidade: o colaborador decide se aparece em ranking. Gamificação
   * nunca deve servir para constranger ninguém (ver engines/gamification).
   */
  preferences: {
    rankingOptIn: boolean;
    notifications: boolean;
    reducedMotion?: boolean;
  };
  onboardedAt?: ISODate;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------
// Banco de Conhecimento ConServ
// ---------------------------------------------------------------------

export type ContentFileType =
  | "pdf"
  | "docx"
  | "txt"
  | "pptx"
  | "imagem"
  | "video"
  | "url"
  | "texto";

export type ContentKind =
  | "manual"
  | "norma"
  | "procedimento"
  | "ficha_tecnica"
  | "apostila"
  | "apresentacao"
  | "artigo"
  | "video_aula"
  | "catalogo";

export type ContentStatus =
  | "draft"
  | "processing"
  | "pending_review"
  | "approved"
  | "published"
  | "archived"
  | "rejected";

export type ContentLevel = "basico" | "intermediario" | "avancado";

/** Trecho de texto extraído do material — a unidade de rastreabilidade. */
export interface ContentChunk {
  index: number;
  text: string;
  locator?: string;
  sourceId: SourceId;
}

export interface ContentItem {
  id: ID; // CNT-000001
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  level: ContentLevel;
  sector: string;
  jobFunction?: string;
  contentType: ContentKind;
  author?: string;
  source: {
    type: ContentFileType;
    reference?: string;
    url?: string;
    /** Arquivo guardado como data URL no protótipo (ver FILE STORAGE). */
    fileRef?: string;
    fileSize?: number;
    mimeType?: string;
  };
  /** Fontes oficiais da biblioteca vinculadas a este material. */
  librarySourceIds: ID[];
  date: ISODate;
  version: string;
  validUntil?: ISODate;
  keywords: string[];
  /** Texto extraído (bruto) — base de tudo que o CONTENT_ENGINE gera. */
  rawText?: string;
  chunks: ContentChunk[];
  competencies: ID[];
  status: ContentStatus;
  analysis?: ContentAnalysis;
  /** O que foi gerado a partir deste material e já virou registro. */
  generated: {
    lessonIds: ID[];
    questionIds: ID[];
    curiosityIds: ID[];
    gameIds: ID[];
    challengeIds: ID[];
    courseIds: ID[];
    handbookIds: ID[];
  };
  createdBy: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
  reviewedBy?: ID;
  reviewedAt?: ISODate;
  publishedAt?: ISODate;
  notes?: string;
}

export interface ContentVersion {
  id: ID;
  contentId: ID;
  version: string;
  changedBy: ID;
  changedByName: string;
  changedAt: ISODate;
  /** O que mudou, em linguagem humana. */
  changes: string[];
  reason?: string;
  sourceNote?: string;
  snapshot: Partial<ContentItem>;
}

export type SourceReliability = "oficial" | "tecnica" | "fabricante" | "interna" | "referencia";

export interface LibrarySource {
  id: ID;
  name: string;
  url?: string;
  institution: string;
  type: "legislacao" | "norma" | "manual" | "instituicao" | "fabricante" | "interno" | "artigo";
  accessedAt?: ISODate;
  reliability: SourceReliability;
  subjects: string[];
  notes?: string;
}

// ---------------------------------------------------------------------
// Análise (CONTENT_ENGINE)
// ---------------------------------------------------------------------

export interface DetectedTerm {
  term: string;
  occurrences: number;
  sourceRefs: SourceRef[];
  definition?: string;
  competencyId?: ID;
}

export interface DetectedProcedure {
  title: string;
  steps: string[];
  sourceRef: SourceRef;
}

export interface DetectedRisk {
  description: string;
  category: string;
  sourceRef: SourceRef;
}

export interface ContentAnalysis {
  analyzedAt: ISODate;
  /** Qual provedor analisou: heurístico local ou API de IA externa. */
  provider: string;
  summary: string;
  subjects: string[];
  concepts: DetectedTerm[];
  terms: string[];
  definitions: Array<{ term: string; text: string; sourceRef: SourceRef }>;
  procedures: DetectedProcedure[];
  risks: DetectedRisk[];
  examples: Array<{ text: string; sourceRef: SourceRef }>;
  competencies: ID[];
  difficulty: ContentLevel;
  readingMinutes: number;
  /** Tudo que a análise propõe — nada é publicado sem aprovação humana. */
  suggestions: {
    lessons: SuggestedLesson[];
    curiosities: SuggestedCuriosity[];
    questions: SuggestedQuestion[];
    games: SuggestedGame[];
    challenges: SuggestedChallenge[];
  };
  /** Avisos de incerteza — a IA precisa sinalizar o que não tem certeza. */
  warnings: string[];
  stats: { words: number; sentences: number; chunks: number };
}

export interface SuggestedLesson {
  title: string;
  summary: string;
  blocks: LessonBlock[];
  durationMin: number;
  competencies: ID[];
  sourceRefs: SourceRef[];
}

export interface SuggestedCuriosity {
  title: string;
  text: string;
  category: string;
  sourceRef: SourceRef;
}

export interface SuggestedQuestion {
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  subject: string;
  competencies: ID[];
  sourceRef: SourceRef;
  confidence: number;
}

export interface SuggestedGame {
  type: GameType;
  title: string;
  pitch: string;
  reason: string;
  payload: GamePayload;
  sourceRefs: SourceRef[];
}

export interface SuggestedChallenge {
  title: string;
  scenario: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  character: CharacterId;
  sourceRef: SourceRef;
}

// ---------------------------------------------------------------------
// Cursos, módulos e aulas
// ---------------------------------------------------------------------

export type CharacterId = "mestre" | "seguranca" | "nenhum";

export type LessonBlock =
  | { kind: "heading"; text: string }
  | { kind: "text"; text: string; sourceId?: SourceId }
  | { kind: "list"; items: string[]; ordered?: boolean; sourceId?: SourceId }
  | { kind: "callout"; tone: "info" | "alerta" | "dica" | "atencao"; title?: string; text: string; sourceId?: SourceId }
  | { kind: "character"; character: CharacterId; text: string }
  | { kind: "image"; url: string; caption?: string; alt: string }
  | { kind: "video"; url: string; caption?: string }
  | { kind: "steps"; title?: string; steps: string[]; sourceId?: SourceId }
  | { kind: "table"; headers: string[]; rows: string[][]; caption?: string; sourceId?: SourceId }
  | { kind: "quote"; text: string; author?: string }
  | { kind: "curiosity"; curiosityId: ID }
  | { kind: "safety"; text: string };

export interface Lesson {
  id: ID;
  courseId: ID;
  moduleId: ID;
  title: string;
  summary: string;
  order: number;
  blocks: LessonBlock[];
  durationMin: number;
  xp: number;
  competencies: ID[];
  sourceRefs: SourceRef[];
  quizId?: ID;
  status: "draft" | "pending_review" | "published" | "archived";
  createdFromContentId?: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface CourseModule {
  id: ID;
  courseId: ID;
  title: string;
  summary: string;
  order: number;
  lessonIds: ID[];
}

export interface Course {
  id: ID;
  code: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  level: ContentLevel;
  sector: string;
  hours: number;
  icon: string;
  accent: string;
  moduleIds: ID[];
  competencies: ID[];
  /** Avaliação final + nota mínima para certificado. */
  finalQuizId?: ID;
  finalChallengeId?: ID;
  passScore: number;
  certificate: {
    enabled: boolean;
    classification: string;
    responsible: string;
  };
  status: "draft" | "pending_review" | "published" | "archived";
  version: string;
  author: string;
  sourceContentIds: ID[];
  librarySourceIds: ID[];
  handbookId?: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
  publishedAt?: ISODate;
}

export interface LearningPath {
  id: ID;
  code: string;
  title: string;
  description: string;
  order: number;
  icon: string;
  accent: string;
  courseIds: ID[];
  competencies: ID[];
  /** Funções para as quais a trilha é recomendada/obrigatória. */
  recommendedFor: string[];
  mandatory: boolean;
  status: "draft" | "published" | "archived";
  certificateEnabled: boolean;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------
// QUIZ_ENGINE
// ---------------------------------------------------------------------

export type QuestionDifficulty = "facil" | "medio" | "dificil";

export type QuestionType =
  | "conhecimento"
  | "interpretacao"
  | "situacao_pratica"
  | "solucao_problema"
  | "identificacao_risco"
  | "sequencia_operacional";

export interface QuestionOption {
  id: ID;
  text: string;
}

export interface Question {
  id: ID;
  stem: string;
  options: QuestionOption[];
  correctOptionId: ID;
  explanation: string;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  subject: string;
  competencies: ID[];
  points: number;
  /** Rastreabilidade obrigatória: nenhuma questão sem fonte. */
  sourceRef: SourceRef;
  contentId?: ID;
  courseId?: ID;
  lessonId?: ID;
  aiGenerated: boolean;
  status: "draft" | "pending_review" | "approved" | "archived";
  reviewedBy?: ID;
  reviewedAt?: ISODate;
  createdAt: ISODate;
  stats?: { answered: number; correct: number };
}

export type QuizScope = "aula" | "modulo" | "curso" | "trilha" | "avulso" | "avaliacao_final";

export interface Quiz {
  id: ID;
  title: string;
  description?: string;
  scope: QuizScope;
  refId?: ID;
  questionIds: ID[];
  /** Quando > 0, sorteia N questões do conjunto a cada tentativa. */
  drawCount: number;
  passScore: number;
  timeLimitSec?: number;
  shuffleOptions: boolean;
  xp: number;
  status: "draft" | "pending_review" | "published" | "archived";
  createdAt: ISODate;
}

export interface QuizAttempt {
  id: ID;
  quizId: ID;
  employeeId: ID;
  courseId?: ID;
  answers: Array<{
    questionId: ID;
    optionId: ID | null;
    correct: boolean;
    timeSec: number;
    competencies: ID[];
    subject: string;
  }>;
  score: number;
  passed: boolean;
  startedAt: ISODate;
  finishedAt: ISODate;
  durationSec: number;
  xpEarned: number;
}

// ---------------------------------------------------------------------
// GAME_ENGINE
// ---------------------------------------------------------------------

export type GameType =
  | "qual_e_o_defeito"
  | "monte_a_peca"
  | "caca_ao_risco"
  | "salve_a_maquina"
  | "mestre_da_qualidade"
  | "desafio_60s";

/** Rodada de "Qual é o defeito?" / "Salve a máquina" / "Mestre da qualidade". */
export interface DiagnosisRound {
  id: ID;
  situation: string;
  hint?: string;
  options: Array<{ id: ID; label: string; description?: string }>;
  correctOptionId: ID;
  explanation: string;
  sourceId?: SourceId;
}

export interface SequenceRound {
  id: ID;
  instruction: string;
  items: Array<{ id: ID; label: string; correctOrder: number; icon?: string }>;
  explanation: string;
  sourceId?: SourceId;
}

export interface HotspotRound {
  id: ID;
  instruction: string;
  /** Cena desenhada por componentes (sem depender de imagem externa). */
  scene: string;
  spots: Array<{
    id: ID;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
    isTarget: boolean;
    feedback: string;
    category?: string;
    sourceId?: SourceId;
  }>;
  targetsToFind: number;
  explanation: string;
}

export interface TimedQuizRound {
  id: ID;
  seconds: number;
  questionIds: ID[];
  /** Fallback quando o jogo carrega perguntas próprias, não do banco. */
  inlineQuestions?: Array<{
    id: ID;
    stem: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    sourceId?: SourceId;
  }>;
}

export type GamePayload =
  | { kind: "diagnosis"; rounds: DiagnosisRound[] }
  | { kind: "sequence"; rounds: SequenceRound[] }
  | { kind: "hotspot"; rounds: HotspotRound[] }
  | { kind: "timed_quiz"; rounds: TimedQuizRound[] };

export interface GameDefinition {
  id: ID;
  code: string;
  type: GameType;
  title: string;
  pitch: string;
  description: string;
  character: CharacterId;
  icon: string;
  accent: string;
  level: ContentLevel;
  competencies: ID[];
  sourceRefs: SourceRef[];
  contentId?: ID;
  courseId?: ID;
  xp: number;
  passScore: number;
  payload: GamePayload;
  status: "draft" | "pending_review" | "published" | "archived";
  createdAt: ISODate;
  aiGenerated: boolean;
}

export interface GameSession {
  id: ID;
  gameId: ID;
  employeeId: ID;
  score: number;
  maxScore: number;
  passed: boolean;
  startedAt: ISODate;
  finishedAt: ISODate;
  durationSec: number;
  xpEarned: number;
  details: Array<{ roundId: ID; correct: boolean; competencies: ID[] }>;
}

// ---------------------------------------------------------------------
// Desafios e curiosidades
// ---------------------------------------------------------------------

export interface Challenge {
  id: ID;
  title: string;
  scenario: string;
  character: CharacterId;
  options: Array<{ id: ID; text: string }>;
  correctOptionId: ID;
  explanation: string;
  category: string;
  competencies: ID[];
  difficulty: QuestionDifficulty;
  xp: number;
  sourceRef: SourceRef;
  dailyEligible: boolean;
  courseId?: ID;
  contentId?: ID;
  status: "draft" | "pending_review" | "published" | "archived";
  createdAt: ISODate;
}

export interface ChallengeAttempt {
  id: ID;
  challengeId: ID;
  employeeId: ID;
  optionId: ID;
  correct: boolean;
  at: ISODate;
  xpEarned: number;
  daily: boolean;
}

export interface Curiosity {
  id: ID;
  title: string;
  text: string;
  imageUrl?: string;
  category: string;
  competencies: ID[];
  sourceRef: SourceRef;
  xp: number;
  status: "draft" | "pending_review" | "published" | "archived";
  createdAt: ISODate;
}

// ---------------------------------------------------------------------
// COMPETENCY_ENGINE
// ---------------------------------------------------------------------

/** 1 Conhecimento · 2 Básico · 3 Operacional · 4 Avançado · 5 Especialista · 6 Mestre */
export type CompetencyLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface Competency {
  id: ID;
  code: string;
  name: string;
  area: string;
  description: string;
  levelDescriptors: Record<CompetencyLevel, string>;
  /** Cursos que desenvolvem a competência (usado nas recomendações). */
  developedBy: ID[];
}

export type CompetencyEvidenceKind =
  | "aula"
  | "quiz"
  | "desafio"
  | "jogo"
  | "curso"
  | "certificado"
  | "avaliacao_gestor"
  | "erp";

export interface EmployeeCompetency {
  id: ID;
  employeeId: ID;
  competencyId: ID;
  level: CompetencyLevel;
  targetLevel?: CompetencyLevel;
  score: number;
  evidence: Array<{
    kind: CompetencyEvidenceKind;
    refId: ID;
    label: string;
    weight: number;
    at: ISODate;
  }>;
  assessedAt: ISODate;
  assessedBy?: ID;
}

// ---------------------------------------------------------------------
// Matrículas, progresso e gamificação
// ---------------------------------------------------------------------

export interface Enrollment {
  id: ID;
  employeeId: ID;
  courseId: ID;
  pathId?: ID;
  status: "nao_iniciado" | "em_andamento" | "concluido" | "reprovado";
  progressPct: number;
  lessonsDone: number;
  lessonsTotal: number;
  startedAt: ISODate;
  lastActivityAt: ISODate;
  completedAt?: ISODate;
  finalScore?: number;
  certificateId?: ID;
  source: "auto" | "gestor" | "autoinscricao" | "obrigatorio";
}

export interface LessonProgress {
  id: ID;
  employeeId: ID;
  courseId: ID;
  lessonId: ID;
  status: "em_andamento" | "concluido";
  timeSpentSec: number;
  startedAt: ISODate;
  completedAt?: ISODate;
}

export interface XpTransaction {
  id: ID;
  employeeId: ID;
  amount: number;
  reason: string;
  refType: "aula" | "quiz" | "desafio" | "jogo" | "curso" | "certificado" | "curiosidade" | "risco" | "onboarding";
  refId?: ID;
  at: ISODate;
}

export type BadgeRule =
  | { kind: "first_course" }
  | { kind: "courses_completed"; count: number }
  | { kind: "lessons_completed"; count: number }
  | { kind: "quiz_score"; min: number; count: number }
  | { kind: "perfect_quiz"; count: number }
  | { kind: "games_passed"; gameType?: GameType; count: number }
  | { kind: "challenges_correct"; count: number }
  | { kind: "risk_reports"; count: number }
  | { kind: "competency_level"; competencyId: ID; level: CompetencyLevel }
  | { kind: "path_completed"; pathId?: ID; count?: number }
  | { kind: "curiosities_read"; count: number }
  | { kind: "xp_total"; amount: number };

export interface Badge {
  id: ID;
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: "bronze" | "prata" | "ouro" | "mestre";
  xp: number;
  rule: BadgeRule;
  active: boolean;
}

export interface EmployeeBadge {
  id: ID;
  employeeId: ID;
  badgeId: ID;
  earnedAt: ISODate;
  context?: string;
}

// ---------------------------------------------------------------------
// CERTIFICATE_ENGINE
// ---------------------------------------------------------------------

export type CertificateKind = "curso" | "trilha" | "avaliacao";

export interface Certificate {
  id: ID;
  /** Código único impresso e usado na validação pública. */
  code: string;
  kind: CertificateKind;
  refId: ID;
  employeeId: ID;
  employeeName: string;
  employeeCode: string;
  title: string;
  hours: number;
  score: number;
  issuedAt: ISODate;
  validUntil?: ISODate;
  responsible: string;
  /**
   * Classificação explícita. Nunca apresentar como certificação oficial
   * ou habilitação legal sem que a empresa defina isso formalmente.
   */
  classification: string;
  status: "valido" | "revogado" | "expirado";
  validationPath: string;
  competencies: ID[];
  librarySourceIds: ID[];
  revokedReason?: string;
}

export interface CertificateValidation {
  id: ID;
  code: string;
  at: ISODate;
  result: "valido" | "nao_encontrado" | "revogado" | "expirado";
  userAgent?: string;
}

// ---------------------------------------------------------------------
// Apostilas
// ---------------------------------------------------------------------

export type HandbookSectionKind =
  | "capa"
  | "sumario"
  | "objetivos"
  | "modulo"
  | "conteudo"
  | "imagens"
  | "exemplos"
  | "curiosidades"
  | "atividades"
  | "desafios"
  | "quiz"
  | "avaliacao"
  | "gabarito"
  | "referencias"
  | "conclusao";

export interface HandbookSection {
  id: ID;
  kind: HandbookSectionKind;
  title: string;
  blocks: LessonBlock[];
  /** Usado nas seções de quiz/gabarito. */
  questionIds?: ID[];
  order: number;
}

export interface Handbook {
  id: ID;
  code: string;
  title: string;
  subtitle?: string;
  courseId?: ID;
  contentIds: ID[];
  version: string;
  hours: number;
  author: string;
  date: ISODate;
  objectives: string[];
  sections: HandbookSection[];
  references: Array<{ label: string; detail: string; url?: string }>;
  conclusion: string;
  status: "draft" | "pending_review" | "published" | "archived";
  createdBy: ID;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------
// "Eu vi um risco"
// ---------------------------------------------------------------------

export type RiskStatus = "aberto" | "em_analise" | "acao_definida" | "resolvido" | "encerrado";
export type RiskPriority = "baixa" | "media" | "alta" | "critica";

export interface RiskReport {
  id: ID;
  code: string;
  employeeId?: ID;
  employeeName?: string;
  anonymous: boolean;
  sector: string;
  place: string;
  category: string;
  description: string;
  photoRef?: string;
  priority: RiskPriority;
  status: RiskStatus;
  createdAt: ISODate;
  timeline: Array<{
    at: ISODate;
    status: RiskStatus;
    note: string;
    byId?: ID;
    byName?: string;
  }>;
  actionPlan?: { what: string; who: string; when: ISODate; done: boolean };
  closedAt?: ISODate;
}

// ---------------------------------------------------------------------
// Notificações, auditoria e configurações
// ---------------------------------------------------------------------

export interface Notification {
  id: ID;
  employeeId?: ID;
  role?: Role;
  title: string;
  body: string;
  kind: "info" | "conquista" | "tarefa" | "risco" | "aprovacao" | "recomendacao";
  link?: string;
  read: boolean;
  createdAt: ISODate;
}

export interface AuditLog {
  id: ID;
  actorId: ID;
  actorName: string;
  action: string;
  entity: string;
  entityId?: ID;
  at: ISODate;
  detail?: string;
  meta?: Record<string, unknown>;
}

export type AiTone = "didatico" | "direto" | "motivador" | "tecnico";

/** Seção 36 — a IA precisa ser controlável pelo administrador. */
export interface AiSettings {
  questionsPerContent: number;
  questionDifficultyMix: Record<QuestionDifficulty, number>;
  level: ContentLevel;
  tone: AiTone;
  gamesPerContent: number;
  allowedGameTypes: GameType[];
  curiositiesPerContent: number;
  lessonsPerContent: number;
  challengesPerContent: number;
  targetHours: number;
  audience: string;
  sector: string;
  jobFunction: string;
  competencies: ID[];
  allowedLibrarySourceIds: ID[];
  requireHumanReview: boolean;
  /** Endpoint externo de IA. Vazio = usa o analisador heurístico local. */
  remoteProvider: { enabled: boolean; endpoint: string; model: string };
}

export interface AppSettings {
  id: "settings";
  brandName: string;
  tagline: string;
  defaultPassScore: number;
  rankingEnabled: boolean;
  certificateResponsible: string;
  certificateClassification: string;
  legalDisclaimer: string;
  xpRules: {
    lesson: number;
    quiz: number;
    challenge: number;
    course: number;
    certificate: number;
    curiosity: number;
    game: number;
    riskReport: number;
  };
  levels: Array<{ level: number; name: string; minXp: number }>;
  ai: AiSettings;
  erpIntegration: { enabled: boolean; baseUrl: string; apiKey: string };
  /**
   * Gravado por último na carga inicial. Serve de marca de "carga
   * completa": se a página for fechada no meio do seed, este campo não
   * existe e a carga é refeita na próxima abertura, em vez de o sistema
   * seguir com o banco pela metade.
   */
  seedCompletedAt?: ISODate;
  updatedAt: ISODate;
}

// ---------------------------------------------------------------------
// Tipos auxiliares de apresentação (não persistidos)
// ---------------------------------------------------------------------

export interface LevelInfo {
  level: number;
  name: string;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number | null;
  progressPct: number;
  xpToNext: number | null;
}

export interface CompetencyGap {
  competencyId: ID;
  competencyName: string;
  area: string;
  current: CompetencyLevel | 0;
  target: CompetencyLevel;
  gap: number;
  recommendedCourseIds: ID[];
}

export interface Recommendation {
  id: string;
  kind: "curso" | "aula" | "quiz" | "desafio" | "jogo" | "trilha" | "curiosidade" | "reforco";
  title: string;
  reason: string;
  refId: ID;
  priority: number;
  link: string;
}
