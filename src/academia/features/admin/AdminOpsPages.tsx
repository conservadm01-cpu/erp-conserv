import { useState } from "react";
import type { AppSettings, RiskReport, RiskStatus } from "../../core/types";
import {
  auditRepo, catalogRepo, certificateRepo, competencyRepo, gamificationRepo, learningRepo, notificationRepo,
  peopleRepo, riskRepo, settingsRepo,
} from "../../data/repositories";
import { useQuery, useDbStatus } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useRouter } from "../../router/Router";
import { useToast } from "../../state/ToastContext";
import { useBoot } from "../../state/DatabaseProvider";
import { certificateEngine } from "../../engines/certificate/CertificateEngine";
import { competencyEngine } from "../../engines/competency/CompetencyEngine";
import { notificationEngine } from "../../engines/notification/NotificationEngine";
import { erpBridge } from "../../integrations/erp/ErpBridge";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card, SectionTitle } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip, StatusChip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { Tabs } from "../../ui/primitives/Tabs";
import { Modal } from "../../ui/primitives/Modal";
import { Field, Select, TextArea, TextInput, Toggle } from "../../ui/primitives/Field";
import { Callout, EmptyState, StatTile } from "../../ui/primitives/Feedback";
import { ProgressBar } from "../../ui/primitives/Progress";
import { formatDate, formatDateTime, nowIso, relativeFrom } from "../../core/dates";
import { cn } from "../../core/cn";

// =====================================================================
// CERTIFICADOS
// =====================================================================
export function CertificatesAdminPage() {
  const { employee, can } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const [revoking, setRevoking] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const data = useQuery(() => ({
    certificates: [...certificateRepo.all()].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    validations: [...certificateRepo.validations()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12),
  }));

  return (
    <div>
      <PageHeader title="Certificados" subtitle="Emissões, validações públicas e revogação." icon="award" />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-5">
        <StatTile label="Emitidos" value={data.certificates.length} icon="award" accent="copper" />
        <StatTile label="Válidos" value={data.certificates.filter((c) => c.status === "valido").length} icon="check-circle" accent="jade" />
        <StatTile label="Revogados" value={data.certificates.filter((c) => c.status === "revogado").length} icon="x" accent="alert" />
        <StatTile label="Consultas de validação" value={certificateRepo.validations().length} icon="search" />
      </div>

      <div className="space-y-2.5">
        {data.certificates.map((certificate) => (
          <Card key={certificate.id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-[14.5px]">{certificate.title}</h3>
                  <StatusChip status={certificate.status} />
                </div>
                <p className="text-[13px] text-ink-600">
                  {certificate.employeeName} ({certificate.employeeCode}) · {certificate.hours}h · {certificate.score}% · {formatDate(certificate.issuedAt)}
                </p>
                <p className="text-[11.5px] text-ink-400 mt-0.5">{certificate.classification}</p>
              </div>
              <Chip tone="neutral">{certificate.code}</Chip>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" icon="eye" onClick={() => navigate(`/certificado/${certificate.code}`)}>Abrir</Button>
                {can("certificate.revoke") && certificate.status === "valido" && (
                  <Button size="sm" variant="ghost" icon="x" onClick={() => setRevoking(certificate.id)}>Revogar</Button>
                )}
              </div>
            </div>
          </Card>
        ))}
        {data.certificates.length === 0 && <EmptyState icon="award" title="Nenhum certificado emitido" />}
      </div>

      <Card className="p-4 mt-5">
        <SectionTitle hint="Toda consulta à página pública fica registrada.">Validações recentes</SectionTitle>
        <ul className="space-y-1.5">
          {data.validations.map((validation) => (
            <li key={validation.id} className="text-[13px] flex items-center gap-2">
              <Icon name={validation.result === "valido" ? "check-circle" : "alert"} size={14} className={validation.result === "valido" ? "text-jade-600" : "text-copper-600"} />
              <code className="text-[12px]">{validation.code}</code>
              <span className="text-ink-600">{validation.result}</span>
              <span className="text-ink-400 ml-auto">{relativeFrom(validation.at)}</span>
            </li>
          ))}
          {data.validations.length === 0 && <li className="text-[13px] text-ink-600">Nenhuma consulta ainda.</li>}
        </ul>
      </Card>

      {revoking && (
        <Modal
          open
          onClose={() => setRevoking(null)}
          title="Revogar certificado"
          subtitle="A página pública passará a mostrar o certificado como revogado."
          footer={
            <>
              <Button variant="ghost" onClick={() => setRevoking(null)}>Cancelar</Button>
              <Button
                variant="danger"
                icon="x"
                disabled={reason.trim().length < 5}
                onClick={() => {
                  if (!employee) return;
                  certificateEngine.revoke(revoking, reason);
                  auditRepo.log({ actorId: employee.id, actorName: employee.name, action: "certificate.revoke", entity: "certificates", entityId: revoking, detail: reason });
                  setRevoking(null);
                  setReason("");
                  toast.success("Certificado revogado");
                }}
              >
                Revogar
              </Button>
            </>
          }
        >
          <Field label="Motivo da revogação" required>
            <TextArea value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </Modal>
      )}
    </div>
  );
}

// =====================================================================
// RISCOS REPORTADOS (painel do gestor, seção 19)
// =====================================================================
const RISK_FLOW: RiskStatus[] = ["aberto", "em_analise", "acao_definida", "resolvido", "encerrado"];

export function RisksAdminPage() {
  const { employee } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState("abertos");
  const [selected, setSelected] = useState<RiskReport | null>(null);

  const data = useQuery(() => {
    const all = [...riskRepo.all()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      all,
      open: all.filter((r) => r.status !== "resolvido" && r.status !== "encerrado"),
      closed: all.filter((r) => r.status === "resolvido" || r.status === "encerrado"),
      critical: all.filter((r) => r.priority === "critica" || r.priority === "alta"),
    };
  });

  const list = filter === "abertos" ? data.open : filter === "criticos" ? data.critical : filter === "encerrados" ? data.closed : data.all;

  const advance = (report: RiskReport, status: RiskStatus, note: string) => {
    if (!employee) return;
    const updated: RiskReport = {
      ...report,
      status,
      timeline: [...report.timeline, { at: nowIso(), status, note, byId: employee.id, byName: employee.name }],
      closedAt: status === "encerrado" || status === "resolvido" ? nowIso() : report.closedAt,
    };
    riskRepo.save(updated);
    auditRepo.log({ actorId: employee.id, actorName: employee.name, action: `risk.${status}`, entity: "risk_reports", entityId: report.id, detail: `${report.code}: ${note}` });
    if (report.employeeId) {
      notificationEngine.notifyEmployee(
        report.employeeId,
        `Seu registro ${report.code} foi atualizado`,
        `Status: ${status.replace(/_/g, " ")} — ${note}`,
        "risco",
        "/risco",
      );
    }
    setSelected(updated);
    toast.success("Risco atualizado");
  };

  return (
    <div>
      <PageHeader title="Riscos reportados" subtitle="O que a equipe viu e o que a empresa fez a respeito." icon="siren" />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-5">
        <StatTile label="Abertos" value={data.open.length} icon="siren" accent="alert" />
        <StatTile label="Alta/crítica" value={data.critical.length} icon="alert" accent="copper" />
        <StatTile label="Resolvidos" value={data.closed.length} icon="check-circle" accent="jade" />
        <StatTile label="Total" value={data.all.length} icon="clipboard" />
      </div>

      <Tabs
        className="mb-4"
        active={filter}
        onChange={setFilter}
        items={[
          { id: "abertos", label: "Em aberto", badge: data.open.length },
          { id: "criticos", label: "Alta/crítica", badge: data.critical.length },
          { id: "encerrados", label: "Resolvidos", badge: data.closed.length },
          { id: "todos", label: "Todos", badge: data.all.length },
        ]}
      />

      <div className="space-y-2.5">
        {list.map((report) => (
          <Card key={report.id} className="p-4" interactive onClick={() => setSelected(report)}>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Chip tone="neutral">{report.code}</Chip>
              <StatusChip status={report.status} />
              <Chip tone={report.priority === "critica" ? "alert" : report.priority === "alta" ? "copper" : "neutral"}>{report.priority}</Chip>
              {report.anonymous && <Chip tone="sand" icon="lock">anônimo</Chip>}
              <span className="text-[11.5px] text-ink-400 ml-auto">{relativeFrom(report.createdAt)}</span>
            </div>
            <p className="text-[14px]"><strong>{report.sector}</strong> · {report.place} · {report.category}</p>
            <p className="text-[13.5px] text-ink-600 mt-0.5 line-clamp-2">{report.description}</p>
          </Card>
        ))}
        {list.length === 0 && <EmptyState icon="shield" title="Nada neste filtro" />}
      </div>

      {selected && <RiskModal report={selected} onClose={() => setSelected(null)} onAdvance={advance} />}
    </div>
  );
}

function RiskModal({ report, onClose, onAdvance }: {
  report: RiskReport;
  onClose: () => void;
  onAdvance: (report: RiskReport, status: RiskStatus, note: string) => void;
}) {
  const [status, setStatus] = useState<RiskStatus>(RISK_FLOW[Math.min(RISK_FLOW.indexOf(report.status) + 1, RISK_FLOW.length - 1)]);
  const [note, setNote] = useState("");
  const [plan, setPlan] = useState(report.actionPlan ?? { what: "", who: "", when: "", done: false });

  return (
    <Modal
      open
      onClose={onClose}
      title={`${report.code} · ${report.category}`}
      subtitle={`${report.sector} · ${report.place}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button
            icon="check"
            disabled={note.trim().length < 5}
            onClick={() => {
              if (plan.what.trim()) {
                riskRepo.save({ ...report, actionPlan: { what: plan.what, who: plan.who, when: plan.when || nowIso(), done: plan.done } });
              }
              onAdvance(report, status, note);
              setNote("");
            }}
          >
            Registrar andamento
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <StatusChip status={report.status} />
          <Chip tone={report.priority === "critica" ? "alert" : "copper"}>{report.priority}</Chip>
          {report.anonymous ? <Chip tone="sand" icon="lock">anônimo</Chip> : <Chip tone="navy">{report.employeeName}</Chip>}
          <Chip tone="neutral">{formatDateTime(report.createdAt)}</Chip>
        </div>

        <div>
          <div className="label">Descrição</div>
          <p className="text-[14.5px] leading-relaxed">{report.description}</p>
        </div>

        {report.photoRef && (
          <div>
            <div className="label">Foto</div>
            <img src={report.photoRef} alt="Foto do risco" className="rounded-xl border border-sand max-h-72 object-contain" />
          </div>
        )}

        <div>
          <div className="label">Histórico</div>
          <ol className="space-y-2">
            {report.timeline.map((entry, i) => (
              <li key={i} className="flex gap-2.5 text-[13px]">
                <span className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-copper" />
                <span>
                  <strong>{entry.status.replace(/_/g, " ")}</strong> · {entry.note}
                  <span className="text-ink-400"> — {formatDateTime(entry.at)}{entry.byName ? ` · ${entry.byName}` : ""}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-xl border border-sand bg-linen-100/50 p-4 space-y-3">
          <div className="label mb-0">Plano de ação</div>
          <Field label="O que será feito"><TextInput value={plan.what} onChange={(e) => setPlan({ ...plan, what: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Responsável"><TextInput value={plan.who} onChange={(e) => setPlan({ ...plan, who: e.target.value })} /></Field>
            <Field label="Prazo"><TextInput type="date" value={plan.when?.slice(0, 10) ?? ""} onChange={(e) => setPlan({ ...plan, when: e.target.value })} /></Field>
          </div>
          <Toggle checked={plan.done} onChange={(done) => setPlan({ ...plan, done })} label="Ação concluída" />
        </div>

        <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
          <Field label="Novo status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as RiskStatus)}>
              {RISK_FLOW.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </Select>
          </Field>
          <Field label="Observação do andamento" required>
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que foi verificado/decidido" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

// =====================================================================
// RELATÓRIOS (seção 38)
// =====================================================================
export function ReportsPage() {
  const data = useQuery(() => {
    const employees = peopleRepo.activeEmployees();
    const enrollments = learningRepo.enrollments();
    const attempts = learningRepo.quizAttempts();
    const completed = enrollments.filter((e) => e.status === "concluido");
    const contents = catalogRepo.contents();
    const byDepartment = new Map<string, { employees: number; completed: number; xp: number }>();
    for (const employee of employees) {
      const dept = peopleRepo.departmentName(employee.departmentId);
      const current = byDepartment.get(dept) ?? { employees: 0, completed: 0, xp: 0 };
      current.employees += 1;
      current.completed += learningRepo.completed(employee.id).length;
      current.xp += gamificationRepo.totalXp(employee.id);
      byDepartment.set(dept, current);
    }
    const gapsByCompetency = new Map<string, number>();
    for (const employee of employees) {
      for (const gap of competencyEngine.gaps(employee.id)) {
        gapsByCompetency.set(gap.competencyName, (gapsByCompetency.get(gap.competencyName) ?? 0) + 1);
      }
    }
    const subjectStats = new Map<string, { total: number; correct: number }>();
    for (const attempt of attempts) {
      for (const answer of attempt.answers) {
        const current = subjectStats.get(answer.subject) ?? { total: 0, correct: 0 };
        current.total += 1;
        if (answer.correct) current.correct += 1;
        subjectStats.set(answer.subject, current);
      }
    }
    return {
      employees: employees.length,
      enrollments: enrollments.length,
      inProgress: enrollments.filter((e) => e.status === "em_andamento").length,
      completed: completed.length,
      completionRate: enrollments.length === 0 ? 0 : Math.round((completed.length / enrollments.length) * 100),
      avgQuiz: attempts.length === 0 ? 0 : Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length),
      hours: completed.reduce((sum, e) => sum + (catalogRepo.course(e.courseId)?.hours ?? 0), 0),
      certificates: certificateRepo.all().length,
      publishedContents: contents.filter((c) => c.status === "published").length,
      pendingContents: contents.filter((c) => c.status === "pending_review").length,
      risks: riskRepo.all().length,
      openRisks: riskRepo.open().length,
      byDepartment: [...byDepartment.entries()].sort((a, b) => b[1].completed - a[1].completed),
      gaps: [...gapsByCompetency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      subjects: [...subjectStats.entries()]
        .map(([subject, stat]) => ({ subject, accuracy: Math.round((stat.correct / stat.total) * 100), total: stat.total }))
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 8),
      games: learningRepo.gameSessions().length,
      challenges: learningRepo.challengeAttempts().length,
    };
  });

  return (
    <div>
      <PageHeader title="Relatórios" subtitle="Indicadores de capacitação, competências e segurança." icon="trending-up" />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatTile label="Colaboradores ativos" value={data.employees} icon="users" />
        <StatTile label="Cursos em andamento" value={data.inProgress} icon="book-open" />
        <StatTile label="Cursos concluídos" value={data.completed} icon="check-circle" accent="jade" />
        <StatTile label="Taxa de conclusão" value={`${data.completionRate}%`} icon="trending-up" accent="copper" />
        <StatTile label="Média dos quizzes" value={`${data.avgQuiz}%`} icon="clipboard" />
        <StatTile label="Horas de treinamento" value={`${data.hours}h`} icon="clock" accent="sand" />
        <StatTile label="Certificados" value={data.certificates} icon="award" accent="copper" />
        <StatTile label="Conteúdos publicados" value={data.publishedContents} hint={`${data.pendingContents} aguardando aprovação`} icon="file" />
        <StatTile label="Partidas jogadas" value={data.games} icon="gamepad-2" />
        <StatTile label="Desafios respondidos" value={data.challenges} icon="zap" accent="copper" />
        <StatTile label="Riscos reportados" value={data.risks} hint={`${data.openRisks} em aberto`} icon="siren" accent="alert" />
        <StatTile label="Matrículas" value={data.enrollments} icon="users" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle hint="Conclusões e XP por setor.">Desempenho por setor</SectionTitle>
          <ul className="space-y-2.5">
            {data.byDepartment.map(([dept, stat]) => (
              <li key={dept}>
                <div className="flex justify-between text-[13.5px] mb-1">
                  <span className="font-semibold">{dept}</span>
                  <span className="text-ink-600">{stat.completed} conclusão(ões) · {stat.employees} pessoa(s)</span>
                </div>
                <ProgressBar value={stat.employees === 0 ? 0 : Math.min(100, (stat.completed / stat.employees) * 100)} size="sm" />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <SectionTitle hint="Competências onde mais gente está abaixo do alvo da função.">Maiores lacunas</SectionTitle>
          <ul className="space-y-2">
            {data.gaps.map(([name, count]) => (
              <li key={name} className="flex items-center justify-between gap-3 text-[13.5px]">
                <span className="truncate">{name}</span>
                <Chip tone="copper">{count} pessoa(s)</Chip>
              </li>
            ))}
            {data.gaps.length === 0 && <li className="text-[13.5px] text-ink-600">Nenhuma lacuna identificada.</li>}
          </ul>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <SectionTitle hint="Onde a equipe erra mais — base para priorizar treinamento.">Assuntos com menor acerto</SectionTitle>
          <ul className="space-y-2.5">
            {data.subjects.map((subject) => (
              <li key={subject.subject}>
                <div className="flex justify-between text-[13.5px] mb-1">
                  <span className="font-semibold">{subject.subject}</span>
                  <span className={cn("tabular-nums", subject.accuracy < 60 ? "text-alert font-bold" : "text-ink-600")}>
                    {subject.accuracy}% ({subject.total} respostas)
                  </span>
                </div>
                <ProgressBar value={subject.accuracy} tone={subject.accuracy < 60 ? "copper" : "jade"} size="sm" />
              </li>
            ))}
            {data.subjects.length === 0 && <li className="text-[13.5px] text-ink-600">Ainda não há respostas suficientes.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

// =====================================================================
// AUDITORIA
// =====================================================================
export function AuditPage() {
  const logs = useQuery(() => auditRepo.recent(200));
  const [term, setTerm] = useState("");
  const filtered = term
    ? logs.filter((log) => `${log.action} ${log.actorName} ${log.detail ?? ""} ${log.entity}`.toLowerCase().includes(term.toLowerCase()))
    : logs;

  return (
    <div>
      <PageHeader title="Auditoria" subtitle="Quem fez o quê, quando. Registro de todas as ações relevantes." icon="lock" />
      <TextInput className="mb-4 sm:max-w-md" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Filtrar por ação, pessoa ou entidade…" />
      <Card className="overflow-hidden">
        <ul>
          {filtered.map((log) => (
            <li key={log.id} className="px-4 py-3 border-b border-sand/40 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="navy">{log.action}</Chip>
                <span className="text-[13.5px] font-semibold">{log.actorName}</span>
                <span className="text-[12px] text-ink-400 ml-auto">{formatDateTime(log.at)}</span>
              </div>
              {log.detail && <p className="text-[13px] text-ink-600 mt-1">{log.detail}</p>}
              <p className="text-[11.5px] text-ink-400 mt-0.5">{log.entity}{log.entityId ? ` · ${log.entityId}` : ""}</p>
            </li>
          ))}
          {filtered.length === 0 && <li className="p-6 text-center text-[14px] text-ink-600">Nenhum registro.</li>}
        </ul>
      </Card>
    </div>
  );
}

// =====================================================================
// CONFIGURAÇÕES (seções 36 e 39)
// =====================================================================
export function SettingsPage() {
  const { employee } = useAuth();
  const toast = useToast();
  const boot = useBoot();
  const status = useDbStatus();
  const settings = useQuery(() => settingsRepo.get());
  const [tab, setTab] = useState("geral");
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [confirmReseed, setConfirmReseed] = useState(false);

  const save = (changes: Partial<AppSettings>) => {
    if (!employee) return;
    const next = settingsRepo.save(changes);
    setDraft(next);
    auditRepo.log({ actorId: employee.id, actorName: employee.name, action: "settings.update", entity: "settings", entityId: "settings", detail: Object.keys(changes).join(", ") });
    toast.success("Configurações salvas");
  };

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Marca, gamificação, certificados, IA e integração com o ERP." icon="settings" />

      <Tabs
        className="mb-4"
        active={tab}
        onChange={setTab}
        items={[
          { id: "geral", label: "Geral", icon: "settings" },
          { id: "gamificacao", label: "Gamificação", icon: "zap" },
          { id: "ia", label: "IA", icon: "sparkles" },
          { id: "erp", label: "ERP ConServ", icon: "cpu" },
          { id: "dados", label: "Dados", icon: "boxes" },
        ]}
      />

      {tab === "geral" && (
        <Card className="p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da plataforma"><TextInput value={draft.brandName} onChange={(e) => setDraft({ ...draft, brandName: e.target.value })} /></Field>
            <Field label="Frase da marca"><TextInput value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} /></Field>
            <Field label="Nota mínima padrão (%)">
              <TextInput type="number" min={0} max={100} value={draft.defaultPassScore} onChange={(e) => setDraft({ ...draft, defaultPassScore: Number(e.target.value) })} />
            </Field>
            <Field label="Responsável pelos certificados"><TextInput value={draft.certificateResponsible} onChange={(e) => setDraft({ ...draft, certificateResponsible: e.target.value })} /></Field>
          </div>
          <Field label="Classificação padrão do certificado" hint="Nunca apresentar como certificação oficial ou habilitação legal sem decisão formal da empresa.">
            <TextInput value={draft.certificateClassification} onChange={(e) => setDraft({ ...draft, certificateClassification: e.target.value })} />
          </Field>
          <Field label="Aviso legal exibido nos conteúdos normativos">
            <TextArea rows={2} value={draft.legalDisclaimer} onChange={(e) => setDraft({ ...draft, legalDisclaimer: e.target.value })} />
          </Field>
          <Button icon="save" onClick={() => save({
            brandName: draft.brandName,
            tagline: draft.tagline,
            defaultPassScore: draft.defaultPassScore,
            certificateResponsible: draft.certificateResponsible,
            certificateClassification: draft.certificateClassification,
            legalDisclaimer: draft.legalDisclaimer,
          })}>Salvar</Button>
        </Card>
      )}

      {tab === "gamificacao" && (
        <Card className="p-4 space-y-4">
          <Callout tone="info" title="Gamificação com respeito">
            Pontuação serve para reconhecer esforço, nunca para constranger. O ranking é opcional e só inclui quem
            autorizou no próprio perfil.
          </Callout>
          <Toggle
            checked={draft.rankingEnabled}
            onChange={(rankingEnabled) => setDraft({ ...draft, rankingEnabled })}
            label="Ativar ranking interno"
            hint="Mesmo ativo, aparecem apenas colaboradores que autorizaram."
          />
          <div className="grid gap-4 sm:grid-cols-4">
            {(Object.keys(draft.xpRules) as Array<keyof AppSettings["xpRules"]>).map((key) => (
              <Field key={key} label={key}>
                <TextInput
                  type="number"
                  min={0}
                  value={draft.xpRules[key]}
                  onChange={(e) => setDraft({ ...draft, xpRules: { ...draft.xpRules, [key]: Number(e.target.value) } })}
                />
              </Field>
            ))}
          </div>
          <div>
            <div className="label">Níveis</div>
            <ul className="space-y-1.5">
              {draft.levels.map((level, index) => (
                <li key={level.level} className="flex items-center gap-3">
                  <Chip tone="navy">Nível {level.level}</Chip>
                  <TextInput
                    value={level.name}
                    onChange={(e) => {
                      const levels = [...draft.levels];
                      levels[index] = { ...level, name: e.target.value };
                      setDraft({ ...draft, levels });
                    }}
                  />
                  <TextInput
                    type="number"
                    className="max-w-[120px]"
                    value={level.minXp}
                    onChange={(e) => {
                      const levels = [...draft.levels];
                      levels[index] = { ...level, minXp: Number(e.target.value) };
                      setDraft({ ...draft, levels });
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
          <Button icon="save" onClick={() => save({ rankingEnabled: draft.rankingEnabled, xpRules: draft.xpRules, levels: draft.levels })}>Salvar</Button>
        </Card>
      )}

      {tab === "ia" && (
        <Card className="p-4 space-y-4">
          <Callout tone="alerta" title="Regras de IA (seção 24)">
            Usar somente conteúdo autorizado · preservar a fonte · não inventar informação técnica · sinalizar informações
            incertas · sugerir revisão humana · não transformar material educativo em aconselhamento jurídico · não criar
            requisito legal inexistente · manter rastreabilidade.
          </Callout>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Questões por conteúdo"><TextInput type="number" min={1} max={30} value={draft.ai.questionsPerContent} onChange={(e) => setDraft({ ...draft, ai: { ...draft.ai, questionsPerContent: Number(e.target.value) } })} /></Field>
            <Field label="Aulas por conteúdo"><TextInput type="number" min={1} max={12} value={draft.ai.lessonsPerContent} onChange={(e) => setDraft({ ...draft, ai: { ...draft.ai, lessonsPerContent: Number(e.target.value) } })} /></Field>
            <Field label="Curiosidades"><TextInput type="number" min={0} max={12} value={draft.ai.curiositiesPerContent} onChange={(e) => setDraft({ ...draft, ai: { ...draft.ai, curiositiesPerContent: Number(e.target.value) } })} /></Field>
            <Field label="Desafios"><TextInput type="number" min={0} max={8} value={draft.ai.challengesPerContent} onChange={(e) => setDraft({ ...draft, ai: { ...draft.ai, challengesPerContent: Number(e.target.value) } })} /></Field>
            <Field label="Jogos"><TextInput type="number" min={0} max={6} value={draft.ai.gamesPerContent} onChange={(e) => setDraft({ ...draft, ai: { ...draft.ai, gamesPerContent: Number(e.target.value) } })} /></Field>
            <Field label="Carga horária alvo (h)"><TextInput type="number" min={1} value={draft.ai.targetHours} onChange={(e) => setDraft({ ...draft, ai: { ...draft.ai, targetHours: Number(e.target.value) } })} /></Field>
            <Field label="Nível">
              <Select value={draft.ai.level} onChange={(e) => setDraft({ ...draft, ai: { ...draft.ai, level: e.target.value as AppSettings["ai"]["level"] } })}>
                <option value="basico">Básico</option>
                <option value="intermediario">Intermediário</option>
                <option value="avancado">Avançado</option>
              </Select>
            </Field>
            <Field label="Tom">
              <Select value={draft.ai.tone} onChange={(e) => setDraft({ ...draft, ai: { ...draft.ai, tone: e.target.value as AppSettings["ai"]["tone"] } })}>
                <option value="didatico">Didático</option>
                <option value="direto">Direto</option>
                <option value="motivador">Motivador</option>
                <option value="tecnico">Técnico</option>
              </Select>
            </Field>
            <Field label="Público"><TextInput value={draft.ai.audience} onChange={(e) => setDraft({ ...draft, ai: { ...draft.ai, audience: e.target.value } })} /></Field>
          </div>

          <div>
            <div className="label">Dificuldade das questões (%)</div>
            <div className="grid grid-cols-3 gap-3">
              {(["facil", "medio", "dificil"] as const).map((key) => (
                <Field key={key} label={key}>
                  <TextInput
                    type="number"
                    min={0}
                    max={100}
                    value={draft.ai.questionDifficultyMix[key]}
                    onChange={(e) => setDraft({
                      ...draft,
                      ai: { ...draft.ai, questionDifficultyMix: { ...draft.ai.questionDifficultyMix, [key]: Number(e.target.value) } },
                    })}
                  />
                </Field>
              ))}
            </div>
          </div>

          <Toggle
            checked={draft.ai.requireHumanReview}
            onChange={(requireHumanReview) => setDraft({ ...draft, ai: { ...draft.ai, requireHumanReview } })}
            label="Exigir revisão humana antes de publicar"
            hint="Recomendado manter ligado. O fluxo da plataforma já depende de aprovação explícita."
          />

          <div className="rounded-xl border border-sand bg-linen-100/50 p-4 space-y-3">
            <div className="label mb-0">Provedor externo de IA (opcional)</div>
            <p className="text-[12.5px] text-ink-600">
              Sem endpoint configurado, a análise usa o analisador local da ConServ — que funciona offline e mantém
              rastreabilidade. Com endpoint, a resposta externa enriquece a análise local.
            </p>
            <Toggle
              checked={draft.ai.remoteProvider.enabled}
              onChange={(enabled) => setDraft({ ...draft, ai: { ...draft.ai, remoteProvider: { ...draft.ai.remoteProvider, enabled } } })}
              label="Usar IA externa"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Endpoint">
                <TextInput
                  value={draft.ai.remoteProvider.endpoint}
                  onChange={(e) => setDraft({ ...draft, ai: { ...draft.ai, remoteProvider: { ...draft.ai.remoteProvider, endpoint: e.target.value } } })}
                  placeholder="https://sua-api/analisar-conteudo"
                />
              </Field>
              <Field label="Modelo">
                <TextInput
                  value={draft.ai.remoteProvider.model}
                  onChange={(e) => setDraft({ ...draft, ai: { ...draft.ai, remoteProvider: { ...draft.ai.remoteProvider, model: e.target.value } } })}
                  placeholder="nome-do-modelo"
                />
              </Field>
            </div>
            <p className="text-[11.5px] text-ink-400">
              Chaves de API não devem ficar no navegador: o endpoint deve ser um serviço seu (ex.: função serverless) que
              guarda a credencial no servidor.
            </p>
          </div>

          <Button icon="save" onClick={() => save({ ai: draft.ai })}>Salvar configurações de IA</Button>
        </Card>
      )}

      {tab === "erp" && (
        <Card className="p-4 space-y-4">
          <SectionTitle hint="Seção 39 — quando integrado, o sistema recomenda treinamento com base na operação real.">
            Integração com o ERP ConServ
          </SectionTitle>
          <Toggle
            checked={draft.erpIntegration.enabled}
            onChange={(enabled) => setDraft({ ...draft, erpIntegration: { ...draft.erpIntegration, enabled } })}
            label="Ativar integração"
            hint="Requer a API do ERP publicada. Os contratos estão definidos em integrations/erp/ErpBridge.ts."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="URL base da API">
              <TextInput value={draft.erpIntegration.baseUrl} onChange={(e) => setDraft({ ...draft, erpIntegration: { ...draft.erpIntegration, baseUrl: e.target.value } })} placeholder="https://erp.conserv/api" />
            </Field>
            <Field label="Chave de acesso">
              <TextInput value={draft.erpIntegration.apiKey} onChange={(e) => setDraft({ ...draft, erpIntegration: { ...draft.erpIntegration, apiKey: e.target.value } })} placeholder="(guarde no servidor em produção)" />
            </Field>
          </div>
          <div>
            <div className="label">O que a integração habilita</div>
            <ul className="space-y-1.5 text-[13.5px]">
              {erpBridge.capabilities().map((capability) => (
                <li key={capability.id} className="flex items-start gap-2">
                  <Icon name="arrow-right" size={14} className="mt-1 shrink-0 text-ink-400" />
                  <span><strong>{capability.label}:</strong> {capability.description}</span>
                </li>
              ))}
            </ul>
          </div>
          <Button icon="save" onClick={() => save({ erpIntegration: draft.erpIntegration })}>Salvar</Button>
        </Card>
      )}

      {tab === "dados" && (
        <Card className="p-4 space-y-4">
          <SectionTitle>Ambiente de dados</SectionTitle>
          <ul className="space-y-2 text-[13.5px]">
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-600">Persistência</span>
              <Chip tone={status.shared ? "jade" : "copper"}>{status.adapter}</Chip>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-600">Registros</span><strong>{status.records}</strong>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-600">Notificações no sistema</span><strong>{notificationRepo.all().length}</strong>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-600">Competências cadastradas</span><strong>{competencyRepo.all().length}</strong>
            </li>
          </ul>
          <Callout tone="alerta" title="Restaurar demonstração">
            Apaga TODOS os dados da Academia (conteúdos, cursos, progresso, certificados) e recria a carga inicial.
            Use apenas em ambiente de teste.
          </Callout>
          <Button variant="danger" icon="rotate" onClick={() => setConfirmReseed(true)}>Restaurar demonstração</Button>

          {confirmReseed && (
            <Modal
              open
              onClose={() => setConfirmReseed(false)}
              title="Apagar tudo e recriar a demonstração?"
              subtitle="Esta ação não pode ser desfeita."
              footer={
                <>
                  <Button variant="ghost" onClick={() => setConfirmReseed(false)}>Cancelar</Button>
                  <Button
                    variant="danger"
                    icon="rotate"
                    onClick={async () => {
                      setConfirmReseed(false);
                      await boot.reseed();
                      toast.success("Demonstração recriada");
                    }}
                  >
                    Apagar e recriar
                  </Button>
                </>
              }
            >
              <p className="text-[14px]">
                Todos os registros da Academia serão removidos do banco e a carga inicial será gravada novamente.
                Os dados do ERP (produção, estoque) não são afetados.
              </p>
            </Modal>
          )}
        </Card>
      )}
    </div>
  );
}
