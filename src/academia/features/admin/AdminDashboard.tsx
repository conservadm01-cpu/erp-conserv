import { auditRepo, catalogRepo, certificateRepo, learningRepo, peopleRepo, riskRepo } from "../../data/repositories";
import { useQuery, useDbStatus } from "../../state/useCollection";
import { useRouter } from "../../router/Router";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card, SectionTitle } from "../../ui/primitives/Card";
import { StatTile } from "../../ui/primitives/Feedback";
import { Button } from "../../ui/primitives/Button";
import { Chip, StatusChip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { relativeFrom } from "../../core/dates";

export function AdminDashboard() {
  const { navigate } = useRouter();
  const status = useDbStatus();

  const data = useQuery(() => {
    const employees = peopleRepo.activeEmployees();
    const enrollments = learningRepo.enrollments();
    const attempts = learningRepo.quizAttempts();
    const contents = catalogRepo.contents();
    const pending = catalogRepo.pendingContents();
    const risks = riskRepo.all();
    const openRisks = riskRepo.open();
    const completed = enrollments.filter((e) => e.status === "concluido");
    const hours = completed.reduce((sum, e) => sum + (catalogRepo.course(e.courseId)?.hours ?? 0), 0);
    return {
      employees: employees.length,
      enrollments: enrollments.length,
      inProgress: enrollments.filter((e) => e.status === "em_andamento").length,
      completed: completed.length,
      completionRate: enrollments.length === 0 ? 0 : Math.round((completed.length / enrollments.length) * 100),
      avgScore: attempts.length === 0 ? 0 : Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length),
      contents: contents.length,
      published: contents.filter((c) => c.status === "published").length,
      pending,
      courses: catalogRepo.publishedCourses().length,
      questions: catalogRepo.approvedQuestions().length,
      games: catalogRepo.publishedGames().length,
      certificates: certificateRepo.all().length,
      risks: risks.length,
      openRisks: openRisks.length,
      hours,
      audit: auditRepo.recent(8),
      recentContents: [...contents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
    };
  });

  return (
    <div>
      <PageHeader
        title="Painel administrativo"
        subtitle="Visão geral da Academia ConServ."
        icon="chart"
        action={<Button icon="plus" onClick={() => navigate("/admin/conteudos/novo")}>Novo conteúdo</Button>}
      />

      {data.pending.length > 0 && (
        <Card className="p-4 mb-5 border-copper/40 bg-copper/5">
          <div className="flex flex-wrap items-center gap-3">
            <Icon name="alert" size={22} className="text-copper-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-[15px]">
                {data.pending.length} conteúdo(s) aguardando revisão humana
              </h3>
              <p className="text-[13px] text-ink-600">
                Nada gerado automaticamente é publicado sem aprovação — revise as sugestões antes de liberar.
              </p>
            </div>
            <Button size="sm" variant="copper" onClick={() => navigate("/admin/conteudos")}>Revisar agora</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatTile label="Colaboradores ativos" value={data.employees} icon="users" onClick={() => navigate("/admin/colaboradores")} />
        <StatTile label="Cursos em andamento" value={data.inProgress} icon="book-open" />
        <StatTile label="Cursos concluídos" value={data.completed} icon="check-circle" accent="jade" />
        <StatTile label="Taxa de conclusão" value={`${data.completionRate}%`} icon="trending-up" accent="copper" />
        <StatTile label="Média dos quizzes" value={`${data.avgScore}%`} icon="clipboard" />
        <StatTile label="Horas de treinamento" value={`${data.hours}h`} icon="clock" accent="sand" />
        <StatTile label="Certificados emitidos" value={data.certificates} icon="award" accent="copper" onClick={() => navigate("/admin/certificados")} />
        <StatTile label="Riscos abertos" value={data.openRisks} hint={`${data.risks} no total`} icon="siren" accent="alert" onClick={() => navigate("/admin/riscos")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle hint="O que já existe no Banco de Conhecimento.">Catálogo</SectionTitle>
          <ul className="space-y-2 text-[14px]">
            <Row label="Conteúdos" value={`${data.published} publicados de ${data.contents}`} to="/admin/conteudos" />
            <Row label="Cursos publicados" value={String(data.courses)} to="/admin/cursos" />
            <Row label="Questões aprovadas" value={String(data.questions)} to="/admin/quizzes" />
            <Row label="Jogos publicados" value={String(data.games)} to="/admin/jogos" />
            <Row label="Trilhas" value={String(catalogRepo.paths().length)} to="/admin/trilhas" />
            <Row label="Apostilas" value={String(catalogRepo.handbooks().length)} to="/admin/apostilas" />
          </ul>
        </Card>

        <Card className="p-4">
          <SectionTitle hint="Últimos materiais mexidos.">Conteúdos recentes</SectionTitle>
          <ul className="space-y-2">
            {data.recentContents.map((content) => (
              <li key={content.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/conteudos/${content.id}`)}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-navy/5 flex items-center gap-2.5"
                >
                  <Icon name="file" size={16} className="text-ink-600 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold truncate">{content.title}</span>
                    <span className="block text-[11.5px] text-ink-400">{content.id} · v{content.version} · {relativeFrom(content.updatedAt)}</span>
                  </span>
                  <StatusChip status={content.status} />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <SectionTitle hint="Registro de quem fez o quê.">Auditoria recente</SectionTitle>
          <ul className="space-y-2">
            {data.audit.map((log) => (
              <li key={log.id} className="text-[13px] flex items-start gap-2">
                <Icon name="lock" size={13} className="shrink-0 mt-1 text-ink-400" />
                <span>
                  <strong>{log.action}</strong> · {log.detail ?? log.entity}
                  <span className="text-ink-400"> — {relativeFrom(log.at)}</span>
                </span>
              </li>
            ))}
            {data.audit.length === 0 && <li className="text-[13px] text-ink-600">Sem registros ainda.</li>}
          </ul>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => navigate("/admin/auditoria")}>Ver tudo</Button>
        </Card>

        <Card className="p-4">
          <SectionTitle hint="Onde os dados da Academia estão gravados.">Ambiente</SectionTitle>
          <ul className="space-y-2 text-[13.5px]">
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-600">Persistência</span>
              <Chip tone={status.shared ? "jade" : "copper"}>{status.adapter}</Chip>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-600">Registros carregados</span>
              <strong className="tabular-nums">{status.records}</strong>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-600">Gravações pendentes</span>
              <strong className="tabular-nums">{status.pendingWrites}</strong>
            </li>
            {status.lastError && (
              <li className="text-alert text-[12.5px]">Último erro: {status.lastError}</li>
            )}
            {!status.shared && (
              <li className="text-[12px] text-ink-600 leading-relaxed">
                Sem Supabase configurado, os dados ficam só neste navegador. Configure
                {" "}<code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> para compartilhar com a fábrica.
              </li>
            )}
          </ul>
          <Button size="sm" variant="ghost" className="mt-2" icon="settings" onClick={() => navigate("/admin/configuracoes")}>Configurações</Button>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, to }: { label: string; value: string; to: string }) {
  const { navigate } = useRouter();
  return (
    <li>
      <button type="button" onClick={() => navigate(to)} className="w-full flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-navy/5">
        <span className="text-ink-600">{label}</span>
        <span className="font-bold text-navy-900">{value}</span>
      </button>
    </li>
  );
}
