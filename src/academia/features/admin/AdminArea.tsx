import { matchPath, useRouter } from "../../router/Router";
import { AdminDashboard } from "./AdminDashboard";
import { ContentsPage } from "./ContentsPage";
import { ContentUploaderPage } from "./ContentUploader";
import { ContentDetailPage } from "./ContentDetailPage";
import { EmployeesPage, EmployeeDetailPage } from "./EmployeesPage";
import { SourcesPage } from "./SourcesPage";
import {
  CoursesAdminPage, CourseAdminDetailPage, QuizzesAdminPage, GamesAdminPage, PathsAdminPage,
  HandbooksAdminPage, CompetenciesAdminPage, Nr1AdminPage,
} from "./AdminCatalogPages";
import { CertificatesAdminPage, RisksAdminPage, ReportsPage, AuditPage, SettingsPage } from "./AdminOpsPages";
import { EmptyState } from "../../ui/primitives/Feedback";
import { Button } from "../../ui/primitives/Button";

// =====================================================================
// Área administrativa em um único pedaço carregado sob demanda.
// Quem está na produção (a maioria, no celular) não baixa este código:
// ele só chega quando alguém com permissão abre /admin.
// =====================================================================

const ROTAS: Array<{ pattern: string; render: (p: Record<string, string>) => React.ReactNode }> = [
  { pattern: "/admin", render: () => <AdminDashboard /> },
  { pattern: "/admin/conteudos", render: () => <ContentsPage /> },
  { pattern: "/admin/conteudos/novo", render: () => <ContentUploaderPage /> },
  { pattern: "/admin/conteudos/:contentId", render: (p) => <ContentDetailPage contentId={p.contentId} /> },
  { pattern: "/admin/colaboradores", render: () => <EmployeesPage /> },
  { pattern: "/admin/colaboradores/:employeeId", render: (p) => <EmployeeDetailPage employeeId={p.employeeId} /> },
  { pattern: "/admin/cursos", render: () => <CoursesAdminPage /> },
  { pattern: "/admin/cursos/:courseId", render: (p) => <CourseAdminDetailPage courseId={p.courseId} /> },
  { pattern: "/admin/apostilas", render: () => <HandbooksAdminPage /> },
  { pattern: "/admin/quizzes", render: () => <QuizzesAdminPage /> },
  { pattern: "/admin/jogos", render: () => <GamesAdminPage /> },
  { pattern: "/admin/competencias", render: () => <CompetenciesAdminPage /> },
  { pattern: "/admin/certificados", render: () => <CertificatesAdminPage /> },
  { pattern: "/admin/trilhas", render: () => <PathsAdminPage /> },
  { pattern: "/admin/nr1", render: () => <Nr1AdminPage /> },
  { pattern: "/admin/fontes", render: () => <SourcesPage /> },
  { pattern: "/admin/riscos", render: () => <RisksAdminPage /> },
  { pattern: "/admin/relatorios", render: () => <ReportsPage /> },
  { pattern: "/admin/auditoria", render: () => <AuditPage /> },
  { pattern: "/admin/configuracoes", render: () => <SettingsPage /> },
];

export default function AdminArea() {
  const { path } = useRouter();
  for (const rota of ROTAS) {
    const params = matchPath(rota.pattern, path);
    if (params) return <>{rota.render(params)}</>;
  }
  return (
    <EmptyState
      icon="compass"
      title="Página não encontrada no painel"
      description={`Não existe nada em ${path}.`}
      action={<Button icon="chart" onClick={() => { window.location.hash = "/admin"; }}>Voltar ao painel</Button>}
    />
  );
}
