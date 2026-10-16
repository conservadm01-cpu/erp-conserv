import type { Metadata } from "next";
import { requirePageActor } from "@/server/auth/page-context";
import { can } from "@/server/authz/authorize";
import { getRootUnit } from "@/server/services/org-unit.service";
import { listPrivacyRequests } from "@/server/services/privacy.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { EntityForm, Reveal } from "@/components/ui/EntityForm";
import { PrivacySubjectSearch } from "@/components/phase4/PrivacySubjectSearch";
import { PRIVACY_KIND, PRIVACY_STATUS } from "@/components/works/labels";
import { formatDateTime, formatDay } from "@/lib/format";

export const metadata: Metadata = { title: "Privacidade" };

export default async function PrivacyPage() {
  const actor = await requirePageActor();
  const root = await getRootUnit();
  if (!root || !can(actor, "privacy.manage", root.path)) return <Forbidden />;
  const requests = await listPrivacyRequests(actor);
  const today = new Date();
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title="Solicitações de titulares" description="Registro e atendimento de pedidos sobre dados pessoais (acesso, correção, anonimização e outros)." />
      <Alert tone="info">
        A exportação reúne os dados mantidos pelo sistema e fica registrada na auditoria. A anonimização substitui os dados identificadores do cadastro da pessoa;
        a trilha de auditoria é imutável e não é alterada. Prazos e hipóteses legais devem ser confirmados por quem responde pela proteção de dados.
      </Alert>
      <section className="card space-y-3 p-6" aria-labelledby="nova">
        <h2 id="nova" className="font-semibold">Nova solicitação</h2>
        <PrivacySubjectSearch />
      </section>
      <section aria-labelledby="lista" className="space-y-3">
        <h2 id="lista" className="font-semibold">Solicitações</h2>
        {requests.length === 0 ? (
          <EmptyState title="Nenhuma solicitação registrada" />
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="card space-y-2 p-4 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <strong>{PRIVACY_KIND[r.kind]}</strong> · {r.subjectName} ({r.subjectType === "USUARIO" ? "usuário" : "pessoa"})
                  <Badge tone={r.status === "ABERTA" ? (r.dueDate < today ? "red" : "amber") : "green"}>{PRIVACY_STATUS[r.status]}{r.status === "ABERTA" && r.dueDate < today ? " · prazo interno vencido" : ""}</Badge>
                </p>
                <p className="text-xs text-slate-500">Recebida em {formatDateTime(r.createdAt)} por {r.channel} · prazo interno {formatDay(r.dueDate)}{r.closedAt ? ` · encerrada em ${formatDateTime(r.closedAt)}` : ""}</p>
                <p className="whitespace-pre-line">{r.details}</p>
                {r.resolution && <p className="whitespace-pre-line text-slate-700"><span className="text-slate-500">Resposta: </span>{r.resolution}</p>}
                <div className="flex flex-wrap gap-2">
                  <a href={`/api/privacy/requests/${r.id}/export`} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">Exportar dados (JSON)</a>
                </div>
                {r.status === "ABERTA" && (
                  <Reveal label="Encerrar solicitação">
                    <EntityForm
                      action={`/api/privacy/requests/${r.id}/close`}
                      submitLabel="Encerrar"
                      fields={[
                        { name: "status", label: "Resultado", type: "select", required: true, options: [{ value: "ATENDIDA", label: "Atendida" }, { value: "RECUSADA", label: "Recusada" }] },
                        { name: "resolution", label: "Resposta ao titular", type: "textarea", required: true, maxLength: 2000, span: 2 },
                        ...(r.subjectType === "PESSOA" ? [{ name: "anonymize", label: "Anonimizar o cadastro da pessoa (irreversível)", type: "checkbox" as const }] : []),
                      ]}
                    />
                  </Reveal>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
