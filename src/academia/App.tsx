import { useEffect } from "react";
import { RouterProvider, resolveRoute, useRouter, type RouteDefinition } from "./router/Router";
import { DatabaseProvider } from "./state/DatabaseProvider";
import { ToastProvider } from "./state/ToastContext";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AppShell } from "./ui/layout/AppShell";
import { Button } from "./ui/primitives/Button";
import { Icon } from "./ui/primitives/Icon";
import { EmptyState } from "./ui/primitives/Feedback";
import { CharacterAvatar } from "./ui/characters/Character";

// Telas do colaborador
import { LoginPage } from "./features/onboarding/LoginPage";
import { OnboardingPage } from "./features/onboarding/OnboardingPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { TrailsPage, TrailDetailPage } from "./features/trails/TrailsPage";
import { CoursePage } from "./features/courses/CoursePage";
import { LessonPage } from "./features/courses/LessonPage";
import { QuizRunnerPage } from "./features/courses/QuizRunner";
import { GamesPage } from "./features/games/GamesPage";
import { GameHostPage } from "./features/games/GameHost";
import { ChallengePage, ChallengesPage, ReinforcementPage } from "./features/challenges/ChallengePage";
import { CuriositiesPage } from "./features/curiosities/CuriositiesPage";
import { CompetenciesPage } from "./features/competencies/CompetenciesPage";
import { CertificatesPage, CertificateViewPage } from "./features/certificates/CertificatesPage";
import { ValidateCertificatePage } from "./features/certificates/ValidatePage";
import { HandbooksPage, HandbookViewPage } from "./features/handbooks/HandbooksPage";
import { RiskReportPage } from "./features/risks/RiskPage";
import { WorkstationPage } from "./features/workstation/WorkstationPage";
import { CulturePage } from "./features/culture/CulturePage";
import { ProfilePage, NotificationsPage } from "./features/profile/ProfilePage";

// Telas administrativas
import { AdminDashboard } from "./features/admin/AdminDashboard";
import { ContentsPage } from "./features/admin/ContentsPage";
import { ContentUploaderPage } from "./features/admin/ContentUploader";
import { ContentDetailPage } from "./features/admin/ContentDetailPage";
import { EmployeesPage, EmployeeDetailPage } from "./features/admin/EmployeesPage";
import { SourcesPage } from "./features/admin/SourcesPage";
import {
  CoursesAdminPage, CourseAdminDetailPage, QuizzesAdminPage, GamesAdminPage, PathsAdminPage,
  HandbooksAdminPage, CompetenciesAdminPage, Nr1AdminPage,
} from "./features/admin/AdminCatalogPages";
import {
  CertificatesAdminPage, RisksAdminPage, ReportsPage, AuditPage, SettingsPage,
} from "./features/admin/AdminOpsPages";

// =====================================================================
// Tabela de rotas (hash routing — funciona em hospedagem estática e no
// QR Code do certificado).
// =====================================================================
const ROUTES: RouteDefinition[] = [
  // públicas
  { pattern: "/validar-certificado/:code", public: true, render: (p) => <ValidateCertificatePage code={p.code} /> },
  { pattern: "/validar-certificado", public: true, render: () => <ValidateCertificatePage /> },

  // colaborador
  { pattern: "/", render: () => <DashboardPage /> },
  { pattern: "/inicio", render: () => <DashboardPage /> },
  { pattern: "/trilhas", render: () => <TrailsPage /> },
  { pattern: "/trilha/:pathId", render: (p) => <TrailDetailPage pathId={p.pathId} /> },
  { pattern: "/curso/:courseId", render: (p) => <CoursePage courseId={p.courseId} /> },
  { pattern: "/curso/:courseId/aula/:lessonId", render: (p) => <LessonPage courseId={p.courseId} lessonId={p.lessonId} /> },
  { pattern: "/quiz/:quizId", render: (p) => <QuizRoute quizId={p.quizId} /> },
  { pattern: "/jogos", render: () => <GamesPage /> },
  { pattern: "/jogos/:gameId", render: (p) => <GameHostPage gameId={p.gameId} /> },
  { pattern: "/desafios", render: () => <ChallengesPage /> },
  { pattern: "/desafio/:challengeId", render: (p) => <ChallengePage challengeId={p.challengeId} /> },
  { pattern: "/reforco/:subject", render: (p) => <ReinforcementPage subject={p.subject} /> },
  { pattern: "/curiosidades", render: () => <CuriositiesPage /> },
  { pattern: "/competencias", render: () => <CompetenciesPage /> },
  { pattern: "/certificados", render: () => <CertificatesPage /> },
  { pattern: "/certificado/:code", render: (p) => <CertificateViewPage code={p.code} /> },
  { pattern: "/apostilas", render: () => <HandbooksPage /> },
  { pattern: "/apostila/:handbookId", render: (p) => <HandbookViewPage handbookId={p.handbookId} /> },
  { pattern: "/risco", render: () => <RiskReportPage /> },
  { pattern: "/posto", render: () => <WorkstationPage /> },
  { pattern: "/cultura", render: () => <CulturePage /> },
  { pattern: "/perfil", render: () => <ProfilePage /> },
  { pattern: "/notificacoes", render: () => <NotificationsPage /> },

  // administração
  { pattern: "/admin", admin: true, render: () => <AdminDashboard /> },
  { pattern: "/admin/conteudos", admin: true, render: () => <ContentsPage /> },
  { pattern: "/admin/conteudos/novo", admin: true, render: () => <ContentUploaderPage /> },
  { pattern: "/admin/conteudos/:contentId", admin: true, render: (p) => <ContentDetailPage contentId={p.contentId} /> },
  { pattern: "/admin/colaboradores", admin: true, render: () => <EmployeesPage /> },
  { pattern: "/admin/colaboradores/:employeeId", admin: true, render: (p) => <EmployeeDetailPage employeeId={p.employeeId} /> },
  { pattern: "/admin/cursos", admin: true, render: () => <CoursesAdminPage /> },
  { pattern: "/admin/cursos/:courseId", admin: true, render: (p) => <CourseAdminDetailPage courseId={p.courseId} /> },
  { pattern: "/admin/apostilas", admin: true, render: () => <HandbooksAdminPage /> },
  { pattern: "/admin/quizzes", admin: true, render: () => <QuizzesAdminPage /> },
  { pattern: "/admin/jogos", admin: true, render: () => <GamesAdminPage /> },
  { pattern: "/admin/competencias", admin: true, render: () => <CompetenciesAdminPage /> },
  { pattern: "/admin/certificados", admin: true, render: () => <CertificatesAdminPage /> },
  { pattern: "/admin/trilhas", admin: true, render: () => <PathsAdminPage /> },
  { pattern: "/admin/nr1", admin: true, render: () => <Nr1AdminPage /> },
  { pattern: "/admin/fontes", admin: true, render: () => <SourcesPage /> },
  { pattern: "/admin/riscos", admin: true, render: () => <RisksAdminPage /> },
  { pattern: "/admin/relatorios", admin: true, render: () => <ReportsPage /> },
  { pattern: "/admin/auditoria", admin: true, render: () => <AuditPage /> },
  { pattern: "/admin/configuracoes", admin: true, render: () => <SettingsPage /> },
];

/** Quiz aceita ?curso=ID para fechar o curso ao final da avaliação. */
function QuizRoute({ quizId }: { quizId: string }) {
  const { query } = useRouter();
  const courseId = query.get("curso") ?? undefined;
  return <QuizRunnerPage quizId={quizId} courseId={courseId} />;
}

function Shell() {
  const { path } = useRouter();
  const { isAuthenticated, employee, can } = useAuth();
  const match = resolveRoute(ROUTES, path);

  // Rotas públicas (validação de certificado) não exigem login.
  if (match?.route.public) return <>{match.route.render(match.params)}</>;

  if (!isAuthenticated) return <LoginPage />;

  // Primeira experiência (seção 42).
  if (employee && !employee.onboardedAt && path === "/") return <OnboardingPage />;

  if (!match) {
    return (
      <AppShell>
        <EmptyState
          icon="compass"
          title="Página não encontrada"
          description={`Não existe nada em ${path}.`}
          action={<Button icon="home" onClick={() => { window.location.hash = "/"; }}>Voltar ao início</Button>}
        />
      </AppShell>
    );
  }

  if (match.route.admin && !can("admin.access")) {
    return (
      <AppShell>
        <EmptyState
          icon="lock"
          title="Acesso restrito"
          description="Esta área é da coordenação de treinamento, instrutores e gestores. Colaboradores não alteram conteúdo oficial."
          action={<Button icon="home" onClick={() => { window.location.hash = "/"; }}>Voltar à Academia</Button>}
        />
      </AppShell>
    );
  }

  return <AppShell admin={match.route.admin}>{match.route.render(match.params)}</AppShell>;
}

function BootScreen({ message, error, onRetry }: { message: string; error?: string; onRetry: () => void }) {
  return (
    <div className="min-h-[100dvh] bg-navy-900 text-linen-50 grid place-items-center p-6">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-5">
          <CharacterAvatar character="mestre" size={86} />
        </div>
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-sand-300">Academia ConServ</div>
        <h1 className="text-[24px] font-bold mt-1.5 text-linen-50">Conhecimento que vira qualidade.</h1>
        {error ? (
          <>
            <p className="text-[14.5px] text-linen-200/85 mt-4">
              Não foi possível abrir o banco de dados da Academia.
            </p>
            <p className="text-[12.5px] text-alert-300 mt-2 break-words">{error}</p>
            <Button className="mt-5" variant="copper" icon="refresh" onClick={onRetry}>Tentar novamente</Button>
          </>
        ) : (
          <>
            <p className="text-[14.5px] text-linen-200/85 mt-4 flex items-center justify-center gap-2">
              <Icon name="refresh" size={16} className="animate-spin" />
              {message}
            </p>
            <div className="mt-5 h-1.5 w-56 mx-auto rounded-full bg-linen-50/15 overflow-hidden">
              <div className="h-full w-1/2 bg-copper-300 animate-shimmer" style={{ backgroundSize: "200% 100%" }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Ajusta o título da aba conforme a rota (ajuda no PWA). */
function TitleSync() {
  const { path } = useRouter();
  useEffect(() => {
    const base = "Academia ConServ";
    document.title = path === "/" ? `${base} — Conhecimento que vira qualidade` : `${base} · ${path.replace(/^\//, "")}`;
  }, [path]);
  return null;
}

export default function App() {
  return (
    <RouterProvider>
      <DatabaseProvider fallback={(state) => <BootScreen message={state.message} error={state.error} onRetry={state.reload} />}>
        <ToastProvider>
          <AuthProvider>
            <TitleSync />
            <Shell />
          </AuthProvider>
        </ToastProvider>
      </DatabaseProvider>
    </RouterProvider>
  );
}
