import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/page-context";
import { can, canOnWork } from "@/server/authz/authorize";
import { formatCnpj, getCompany } from "@/server/services/company.service";
import { listCategories, listOwnerDocuments } from "@/server/services/document.service";
import { listWorks } from "@/server/services/work.service";
import { orNotFound } from "@/server/http/page-guard";
import { uuid } from "@/server/validation/common";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { StatusBadge } from "@/components/ui/Badge";
import { ActionButton, EntityForm, Reveal } from "@/components/ui/EntityForm";
import { DocumentsPanel } from "@/components/works/DocumentsPanel";
import { companyFields } from "@/components/phase3/companyFields";
import { CONTRACT_KIND, CONTRACT_STATUS, opts } from "@/components/phase3/labels";
import { formatDateTime, formatDay, serialize } from "@/lib/format";

export const metadata: Metadata = { title: "Empresa" };

const money = (v: { toString(): string } | null) => (v === null ? "—" : Number(v.toString()).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor();
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const c = await orNotFound(() => getCompany(actor, id));
  const [docs, categories, works] = await Promise.all([listOwnerDocuments(actor, "company", c.id, c.unitPath), listCategories(), listWorks(actor)]);
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title={c.legalName} description={<span className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs">{formatCnpj(c.cnpj)}</span>{c.tradeName ? ` · ${c.tradeName}` : ""} · {c.unit.name} · <StatusBadge status={c.status} /></span>} />
      {c.verification === "VERIFICADA_MANUALMENTE" ? (
        <Alert tone="success">Conferência cadastral registrada em {c.verifiedAt ? formatDateTime(c.verifiedAt) : "—"}. Fonte informada: {c.verificationSource}.</Alert>
      ) : (
        <Alert tone="warning" title="Cadastro não conferido">
          O sistema não consulta órgãos oficiais. Registre a conferência somente depois de consultá-la em fonte autorizada.
          {c.canManage && (
            <div className="mt-3">
              <Reveal label="Registrar conferência" variant="secondary">
                <EntityForm action={`/api/companies/${c.id}/verification`} submitLabel="Registrar conferência" fields={[{ name: "source", label: "Fonte consultada e data da consulta", required: true, span: 2, maxLength: 300 }]} />
              </Reveal>
            </div>
          )}
        </Alert>
      )}

      <section className="card p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Dados da empresa</h2>
        {c.canManage ? (
          <EntityForm
            action={`/api/companies/${c.id}`}
            method="PATCH"
            successMessage="Empresa atualizada."
            initial={Object.fromEntries(companyFields.map((f) => [f.name, ((c as unknown as Record<string, string | null>)[f.name] ?? "") as string]))}
            fields={companyFields}
          />
        ) : (
          <p className="text-sm text-slate-600">{c.services ?? "Serviços não informados."}</p>
        )}
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-sm font-semibold text-slate-700">Contratos, aditivos e ordens de serviço</h2>
        {c.contracts.length === 0 ? <p className="text-sm text-slate-500">Nenhum contrato.</p> : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Número</th><th>Tipo</th><th>Objeto</th><th>Obra</th><th>Vigência</th><th>Valor</th><th>Situação</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {c.contracts.map((k) => (
                  <tr key={k.id}>
                    <td className="whitespace-nowrap">{k.number}{k.parent && <span className="block text-xs text-slate-500">aditivo de {k.parent.number}</span>}</td>
                    <td>{CONTRACT_KIND[k.kind]}</td>
                    <td className="max-w-xs">{k.object}</td>
                    <td>{k.work && canOnWork(actor, "work.read", k.work) ? <Link href={`/obras/${k.work.id}`} className="text-brand-700 hover:underline">{k.work.code}</Link> : "—"}</td>
                    <td className="whitespace-nowrap">{formatDay(k.startDate)} a {formatDay(k.endDate)}</td>
                    <td className="whitespace-nowrap tabular-nums">{money(k.value)}</td>
                    <td>
                      {CONTRACT_STATUS[k.status]}
                      {c.canContract && k.status !== "ENCERRADO" && k.status !== "CANCELADO" && (
                        <span className="mt-1 flex gap-1">
                          {k.status === "RASCUNHO" && <ActionButton label="Tornar vigente" variant="ghost" action={`/api/companies/${c.id}/contracts/${k.id}`} method="PATCH" body={{ status: "VIGENTE" }} />}
                          <ActionButton label="Encerrar" variant="ghost" action={`/api/companies/${c.id}/contracts/${k.id}`} method="PATCH" body={{ status: "ENCERRADO" }} confirmText="Encerrar contrato?" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {c.canContract && (
          <Reveal label="Cadastrar contrato">
            <EntityForm
                action={`/api/companies/${c.id}/contracts`}
               
                fields={[
                  { name: "kind", label: "Tipo", type: "select", required: true, options: opts(CONTRACT_KIND) },
                  { name: "number", label: "Número", required: true, maxLength: 60 },
                  { name: "parentId", label: "Contrato original (para aditivos)", type: "select", options: c.contracts.filter((k) => k.kind !== "ADITIVO").map((k) => ({ value: k.id, label: k.number })) },
                  { name: "workId", label: "Obra", type: "select", options: works.map((w) => ({ value: w.id, label: `${w.code} — ${w.title}` })) },
                  { name: "object", label: "Objeto", type: "textarea", required: true, maxLength: 2000 },
                  { name: "value", label: "Valor (R$)", type: "number" },
                  { name: "startDate", label: "Início", type: "date" },
                  { name: "endDate", label: "Término", type: "date" },
                  { name: "status", label: "Situação", type: "select", required: true, options: opts(CONTRACT_STATUS) },
                ]}
                initial={{ status: "RASCUNHO" }}
              />
          </Reveal>
        )}
      </section>

      {c.people.length > 0 && (
        <section className="card p-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Pessoas vinculadas</h2>
          <ul className="text-sm">{c.people.map((p) => <li key={p.id}><Link href={`/pessoas/${p.id}`} className="text-brand-700 hover:underline">{p.name}</Link>{p.jobFunction ? ` — ${p.jobFunction}` : ""}</li>)}</ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Documentos e certificados da empresa</h2>
        <DocumentsPanel uploadPath={`/api/companies/${c.id}/documents`} documents={serialize(docs)} categories={categories} canUpload={can(actor, "document.upload", c.unitPath)} canReview={can(actor, "document.review", c.unitPath)} userId={actor.userId} />
      </section>
    </div>
  );
}
