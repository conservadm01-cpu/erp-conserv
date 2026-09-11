import type {
  AppSettings, AuditLog, Badge, Certificate, CertificateValidation, Challenge, ChallengeAttempt, Competency,
  ContentItem, ContentVersion, Course, CourseModule, Curiosity, Department, Employee, EmployeeBadge,
  EmployeeCompetency, Enrollment, GameDefinition, GameSession, Handbook, JobRole, LearningPath, Lesson,
  LessonProgress, LibrarySource, Notification, Question, Quiz, QuizAttempt, RiskReport, User, XpTransaction,
} from "../core/types";

/**
 * Seção 22 do projeto — as entidades do banco. Cada chave aqui é uma
 * "tabela". No protótipo cada registro é uma linha chave/valor
 * (`academia:v1:<tabela>:<id>`); num banco relacional, cada chave vira
 * uma tabela de verdade com o mesmo nome.
 */
export interface Schema {
  users: User;
  employees: Employee;
  departments: Department;
  job_roles: JobRole;
  content: ContentItem;
  content_versions: ContentVersion;
  content_sources: LibrarySource;
  courses: Course;
  modules: CourseModule;
  lessons: Lesson;
  questions: Question;
  quizzes: Quiz;
  quiz_attempts: QuizAttempt;
  games: GameDefinition;
  game_sessions: GameSession;
  challenges: Challenge;
  challenge_attempts: ChallengeAttempt;
  curiosities: Curiosity;
  competencies: Competency;
  employee_competencies: EmployeeCompetency;
  learning_paths: LearningPath;
  enrollments: Enrollment;
  progress: LessonProgress;
  certificates: Certificate;
  certificate_validations: CertificateValidation;
  badges: Badge;
  employee_badges: EmployeeBadge;
  xp_transactions: XpTransaction;
  handbooks: Handbook;
  risk_reports: RiskReport;
  notifications: Notification;
  audit_logs: AuditLog;
  settings: AppSettings;
}

export type CollectionName = keyof Schema;

export const COLLECTIONS: CollectionName[] = [
  "users", "employees", "departments", "job_roles", "content", "content_versions", "content_sources",
  "courses", "modules", "lessons", "questions", "quizzes", "quiz_attempts", "games", "game_sessions",
  "challenges", "challenge_attempts", "curiosities", "competencies", "employee_competencies",
  "learning_paths", "enrollments", "progress", "certificates", "certificate_validations", "badges",
  "employee_badges", "xp_transactions", "handbooks", "risk_reports", "notifications", "audit_logs",
  "settings",
];

/** Rótulos usados no painel administrativo. */
export const COLLECTION_LABELS: Record<CollectionName, string> = {
  users: "Usuários",
  employees: "Colaboradores",
  departments: "Setores",
  job_roles: "Funções",
  content: "Conteúdos",
  content_versions: "Versões de conteúdo",
  content_sources: "Biblioteca de fontes",
  courses: "Cursos",
  modules: "Módulos",
  lessons: "Aulas",
  questions: "Questões",
  quizzes: "Quizzes",
  quiz_attempts: "Tentativas de quiz",
  games: "Jogos",
  game_sessions: "Partidas",
  challenges: "Desafios",
  challenge_attempts: "Respostas de desafio",
  curiosities: "Curiosidades",
  competencies: "Competências",
  employee_competencies: "Competências por colaborador",
  learning_paths: "Trilhas",
  enrollments: "Matrículas",
  progress: "Progresso de aulas",
  certificates: "Certificados",
  certificate_validations: "Validações de certificado",
  badges: "Badges",
  employee_badges: "Badges conquistados",
  xp_transactions: "Movimentos de XP",
  handbooks: "Apostilas",
  risk_reports: "Riscos reportados",
  notifications: "Notificações",
  audit_logs: "Auditoria",
  settings: "Configurações",
};
