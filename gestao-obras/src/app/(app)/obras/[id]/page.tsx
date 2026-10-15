import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/page-context";
import { canOnWork } from "@/server/authz/authorize";
import { getWork, listWorkCatalogs } from "@/server/services/work.service";
import { listCategories, listWorkDocuments } from "@/server/services/document.service";
import { listWorkRequirements } from "@/server/services/requirement.service";
import { orNotFound } from "@/server/http/page-guard";
import { uuid } from "@/server/validation/common";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { WorkStatusBadge } from "@/components/works/StatusBadges";
import { WorkActions } from "@/components/works/WorkActions";
import { WorkForm } from "@/components/works/WorkForm";
import { StagesPanel } from "@/components/works/StagesPanel";
import { DocumentsPanel } from "@/components/works/DocumentsPanel";
import { RequirementsPanel } from "@/components/works/RequirementsPanel";
import { APPROVAL_KIND, APPROVAL_STATUS, DECISION, EXECUTION_MODE, PRIORITY, WORK_STATUS } from "@/components/works/labels";
import { formatDateTime, formatDay, serialize, toInputDate } from "@/lib/format";
import { workSafetySummary } from "@/server/services/safety.service";
import { listWorkTeam } from "@/server/services/people.service";
import { WorkSafetyPanel } from "@/components/safety/WorkSafetyPanel";
import { PERSON_CATEGORY } from "@/components/phase3/labels";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Obra" };

const TABS = ["resumo", "etapas", "documentos", "requisitos", "equipe", "seguranca", "historico"] as const;
type Tab = (typeof TABS)[number];

export default async function WorkPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> }) {
  const actor = await requirePageActor();
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const { aba } = await searchParams;
  const tab: Tab = TABS.find((t) => t === aba) ?? "resumo";
  const work = await orNotFound(() => getWork(actor, id));
  const canDocs = canOnWork(actor, "document.read", work);
  const canReqs = canOnWork(actor, "requirement.read", work);
  const canSafety = canOnWork(actor, "safety.read", work);
  const [documents, requirements, catalogs] = await Promise.all([
    canDocs ? listWorkDocuments(actor, id) : Promise.resolve([]),
    canReqs ? listWorkRequirements(actor, id) : Promise.resolve([]),
    listWorkCatalogs(),
  ]);
  const base = `/obras/${id}`;
  const pendingReqs = requirements.filter((r) => ["PENDENTE", "NAO_ATENDIDO"].includes(r.status)).length;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={work.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{work.code}</span> · {work.unit.name} · {work.type.name} · <WorkStatusBadge status={work.status} />
          </span>
        }
        actions={
          <>
            <WorkActions workId={work.id} version={work.version} transitions={work.allowed.transitions} />
            {work.allowed.report && <a href={`/api/works/${work.id}/reports/dossie`} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Baixar dossiê (PDF)</a>}
          </>
        }
      />
      <Tabs
        base={base}
        current={tab}
        tabs={[
          { id: "resumo", label: "Resumo" },
          { id: "etapas", label: "Etapas", count: work.stages.length },
          ...(canDocs ? [{ id: "documentos", label: "Documentos", count: documents.length }] : []),
          ...(canReqs ? [{ id: "requisitos", label: "Requisitos", count: pendingReqs }] : []),
          { id: "equipe", label: "Equipe" },
          ...(canSafety ? [{ id: "seguranca", label: "Segurança" }] : []),
          { id: "historico", label: "Histórico" },
        ]}
      />

      {tab === "resumo" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="card p-6 lg:col-span-2">
            {work.allowed.edit ? (
              <WorkForm
                mode="edit"
                workId={work.id}
                version={work.version}
                scopeEditable={work.allowed.editScope}
                units={[]}
                types={catalogs.types}
                activities={catalogs.activities}
                initial={{
                  unitId: work.unitId, title: work.title, typeCode: work.typeCode, activities: work.activities, priority: work.priority, executionMode: work.executionMode,
                  scope: work.scope, justification: work.justification, street: work.street ?? "", number: work.number ?? "", district: work.district ?? "", city: work.city ?? "",
                  state: work.state ?? "", postalCode: work.postalCode ?? "", plannedStart: toInputDate(work.plannedStart), plannedEnd: toInputDate(work.plannedEnd), responsibleName: work.responsibleName ?? "",
                }}
              />
            ) : (
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2"><dt className="text-slate-500">Escopo</dt><dd className="whitespace-pre-line">{work.scope}</dd></div>
                <div className="sm:col-span-2"><dt className="text-slate-500">Justificativa</dt><dd className="whitespace-pre-line">{work.justification}</dd></div>
                <div><dt className="text-slate-500">Prioridade</dt><dd>{PRIORITY[work.priority]}</dd></div>
                <div><dt className="text-slate-500">Forma de execução</dt><dd>{EXECUTION_MODE[work.executionMode]}</dd></div>
                <div><dt className="text-slate-500">Responsável</dt><dd>{work.responsibleName ?? "—"}</dd></div>
                <div><dt className="text-slate-500">Previsão</dt><dd>{formatDay(work.plannedStart)} a {formatDay(work.plannedEnd)}</dd></div>
                <div className="sm:col-span-2"><dt className="text-slate-500">Endereço</dt><dd>{[work.street, work.number, work.district, work.city, work.state].filter(Boolean).join(", ") || "—"}</dd></div>
              </dl>
            )}
          </section>
          <aside className="space-y-4">
            <div className="card p-4 text-sm">
              <h2 className="mb-2 font-semibold text-slate-700">Situação</h2>
              <p><WorkStatusBadge status={work.status} /></p>
              <p className="mt-2 text-xs text-slate-500">Cadastrada por {work.people[work.createdById] ?? "—"} em {formatDateTime(work.createdAt)} · versão {work.version}</p>
            </div>
            {canReqs && (
              <div className="card p-4 text-sm">
                <h2 className="mb-2 font-semibold text-slate-700">Requisitos</h2>
                <p>{requirements.length} aplicáveis · {pendingReqs} pendentes</p>
                <Link href={`${base}?aba=requisitos`} className="text-brand-700 hover:underline">Ver requisitos</Link>
              </div>
            )}
            {work.approvals.some((a) => a.status === "PENDENTE") && (
              <div className="card p-4 text-sm">
                <h2 className="mb-2 font-semibold text-slate-700">Aprovação em andamento</h2>
                {work.approvals.filter((a) => a.status === "PENDENTE").map((a) => (
                  <Link key={a.id} href={`/aprovacoes/${a.id}`} className="text-brand-700 hover:underline">{APPROVAL_KIND[a.kind]}</Link>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}

      {tab === "etapas" && <StagesPanel workId={work.id} stages={serialize(work.stages)} canEdit={work.allowed.edit} />}

      {tab === "documentos" && canDocs && (
        <DocumentsPanel workId={work.id} documents={serialize(documents)} categories={await listCategories()} canUpload={work.allowed.upload} canReview={work.allowed.review} userId={actor.userId} />
      )}

      {tab === "requisitos" && canReqs && (
        <RequirementsPanel
          workId={work.id}
          requirements={serialize(requirements)}
          documents={documents.map((d) => ({ id: d.id, title: d.title, status: d.status }))}
          canEvaluate={work.allowed.evaluate}
          canWaive={work.allowed.waive && work.createdById !== actor.userId}
        />
      )}

      {tab === "equipe" && <TeamTab workId={work.id} />}

      {tab === "seguranca" && canSafety && <WorkSafetyPanel workId={work.id} s={await workSafetySummary(actor, work.id)} activities={catalogs.activities} />}

      {tab === "historico" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="card p-6">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Mudanças de situação</h2>
            <ol className="space-y-3 text-sm">
              {work.statusHistory.map((h) => (
                <li key={h.id} className="border-l-2 border-slate-200 pl-3">
                  <p>{h.fromStatus ? `${WORK_STATUS[h.fromStatus]?.label} → ` : ""}<strong>{WORK_STATUS[h.toStatus]?.label}</strong></p>
                  <p className="text-xs text-slate-500">{formatDateTime(h.createdAt)} · {work.people[h.actorId] ?? "—"}{h.approvalId ? " · por decisão de aprovação" : ""}</p>
                  {h.reason && <p className="mt-1 text-slate-700">{h.reason}</p>}
                </li>
              ))}
            </ol>
          </section>
          <section className="card p-6">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Aprovações</h2>
            {work.approvals.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma aprovação registrada.</p>
            ) : (
              <ul className="space-y-4 text-sm">
                {work.approvals.map((a) => (
                  <li key={a.id}>
                    <p className="font-medium"><Link className="text-brand-700 hover:underline" href={`/aprovacoes/${a.id}`}>{APPROVAL_KIND[a.kind]}</Link> · {APPROVAL_STATUS[a.status]}</p>
                    <p className="text-xs text-slate-500">Versão {a.subjectVersion} · solicitada por {work.people[a.requesterId] ?? "—"} em {formatDateTime(a.createdAt)}</p>
                    <ul className="mt-1 space-y-1">
                      {a.steps.map((s) => (
                        <li key={s.id} className="text-slate-700">{DECISION[s.decision]} — {work.people[s.approverId] ?? "—"} ({formatDateTime(s.decidedAt)}): {s.opinion}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

async function TeamTab({ workId }: { workId: string }) {
  const actor = await requirePageActor();
  const team = await listWorkTeam(actor, workId);
  if (!team.length) return <p className="text-sm text-slate-500">Nenhuma pessoa vinculada. Vincule pessoas a partir do cadastro de cada uma, em Pessoas.</p>;
  return (
    <div className="card overflow-x-auto">
      <table className="table-base">
        <thead><tr><th>Pessoa</th><th>Categoria</th><th>Função</th><th>Período</th><th>Integração de segurança</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {team.map((a) => (
            <tr key={a.id}>
              <td>{a.personVisible ? <Link href={`/pessoas/${a.person.id}`} className="text-brand-700 hover:underline">{a.person.name}</Link> : a.person.name} {a.status === "INATIVO" && <Badge>encerrado</Badge>}</td>
              <td>{PERSON_CATEGORY[a.person.category]}</td>
              <td>{a.role}</td>
              <td className="whitespace-nowrap">{formatDay(a.startDate)} a {formatDay(a.endDate)}</td>
              <td>{a.safetyBriefingAt ? formatDay(a.safetyBriefingAt) : <Badge tone="amber">pendente</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
