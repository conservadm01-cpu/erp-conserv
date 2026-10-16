import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/page-context";
import { can } from "@/server/authz/authorize";
import { getPerson } from "@/server/services/people.service";
import { listCategories, listOwnerDocuments } from "@/server/services/document.service";
import { listWorks, listWorkCatalogs } from "@/server/services/work.service";
import { orNotFound } from "@/server/http/page-guard";
import { uuid } from "@/server/validation/common";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { ActionButton, EntityForm, Reveal } from "@/components/ui/EntityForm";
import { DocumentsPanel } from "@/components/works/DocumentsPanel";
import { CREDENTIAL_KIND, opts, PERSON_CATEGORY, RECEIPT } from "@/components/phase3/labels";
import { formatDateTime, formatDay, serialize, toInputDate } from "@/lib/format";
import { listHealthCertificates } from "@/server/services/health.service";
import { ComplianceList, HealthList } from "@/components/people/PeoplePanels";
import { HealthForm } from "@/components/people/HealthForm";

export const metadata: Metadata = { title: "Pessoa" };

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor();
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const p = await orNotFound(() => getPerson(actor, id));
  const [docs, categories, works, { activities }, health] = await Promise.all([
    listOwnerDocuments(actor, "person", p.id, p.unitPath), listCategories(), listWorks(actor), listWorkCatalogs(), listHealthCertificates(actor, id),
  ]);
  const canHealth = can(actor, "health.manage", p.unitPath);
  const today = new Date().toISOString().slice(0, 10);
  const openWorks = works.filter((w) => !["CONCLUIDA", "ARQUIVADA", "REJEITADA"].includes(w.status));
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title={p.name}
        description={<span className="flex flex-wrap items-center gap-2">{PERSON_CATEGORY[p.category]}{p.bondDescription ? ` (${p.bondDescription})` : ""} · {p.jobFunction ?? "sem função"} · {p.unit.name}{p.company && <> · <Link className="text-brand-700 hover:underline" href={`/empresas/${p.company.id}`}>{p.company.legalName}</Link></>} · <StatusBadge status={p.status} /></span>}
        actions={p.canManage && <ActionButton label={p.status === "ATIVO" ? "Inativar" : "Reativar"} action={`/api/people/${p.id}`} method="PATCH" body={{ status: p.status === "ATIVO" ? "INATIVO" : "ATIVO" }} confirmText={p.status === "ATIVO" ? "Inativar este cadastro?" : undefined} />}
      />

      <section className="card p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Dados de contato e vínculo</h2>
        {p.canManage ? (
          <EntityForm
            action={`/api/people/${p.id}`}
            method="PATCH"
            successMessage="Cadastro atualizado."
            initial={{ name: p.name, jobFunction: p.jobFunction ?? "", email: p.email ?? "", phone: p.phone ?? "", internalId: p.internalId ?? "", bondDescription: p.bondDescription ?? "", legalReviewNote: p.legalReviewNote ?? "", authorizedActivities: p.authorizedActivities }}
            fields={[
              { name: "name", label: "Nome", required: true, maxLength: 200 },
              { name: "jobFunction", label: "Função", maxLength: 120 },
              { name: "email", label: "E-mail", type: "email" },
              { name: "phone", label: "Telefone", maxLength: 30 },
              { name: "internalId", label: "Identificação interna", maxLength: 60 },
              { name: "bondDescription", label: "Descrição do vínculo", maxLength: 300 },
              { name: "legalReviewNote", label: "Observação da avaliação jurídica do vínculo", type: "textarea", maxLength: 1000 },
              { name: "authorizedActivities", label: "Atividades autorizadas", type: "multi", options: activities.map((a) => ({ value: a.code, label: a.name })) },
            ]}
          />
        ) : (
          <p className="text-sm text-slate-600">{p.email ?? "sem e-mail"} · {p.phone ?? "sem telefone"}</p>
        )}
      </section>

      <section className="card space-y-3 p-6" aria-labelledby="exig">
        <h2 id="exig" className="text-sm font-semibold text-slate-700">Exigências das atividades</h2>
        <p className="text-xs text-slate-500">Conforme as atividades autorizadas e as obras em que atua. Exigências pendentes de validação apenas avisam; só as validadas e bloqueantes impedem novos vínculos.</p>
        <ComplianceList items={p.compliance} empty="Nenhuma exigência cadastrada para as atividades desta pessoa." />
      </section>

      {(p.category === "PROFISSIONAL" || p.experience.total > 0) && (
        <section className="card space-y-2 p-6" aria-labelledby="exp">
          <h2 id="exp" className="text-sm font-semibold text-slate-700">Comprovação de experiência</h2>
          {p.experience.total === 0 ? (
            <p className="text-sm text-amber-800">Nenhum comprovante de experiência registrado. Inclua declarações, atestados de capacidade técnica ou registros de trabalho em “Adicionar registro”, tipo “Comprovação de experiência”.</p>
          ) : (
            <p className="text-sm">{p.experience.total} comprovante(s) · {p.experience.verified} conferido(s) em fonte oficial {p.experience.verified === 0 && <Badge tone="amber">nenhum conferido</Badge>}</p>
          )}
        </section>
      )}

      {health !== null && (
        <section className="card space-y-3 p-6" aria-labelledby="aso">
          <h2 id="aso" className="text-sm font-semibold text-slate-700">Saúde ocupacional (ASO) — acesso restrito</h2>
          <p className="text-xs text-slate-500">Visível apenas para quem tem permissão de saúde e para o próprio titular. Registra só a conclusão, as atividades liberadas e a validade; nunca diagnósticos ou resultados de exames.</p>
          <HealthList certs={health} activities={activities} personId={p.id} canManage={canHealth} />
          {canHealth && p.status === "ATIVO" && (
            <Reveal label="Registrar ASO">
              <HealthForm action={`/api/people/${p.id}/health`} activities={activities} allowChecked fileRequired={false} />
            </Reveal>
          )}
        </section>
      )}

      {p.canManage && (
        <section className="card space-y-3 p-6" aria-labelledby="conta">
          <h2 id="conta" className="text-sm font-semibold text-slate-700">Acesso do titular ao portal</h2>
          <p className="text-sm text-slate-600">{p.linkedEmail ? <>Vinculado à conta <strong>{p.linkedEmail}</strong>. A pessoa consulta o próprio cadastro em “Meu cadastro” e envia comprovantes.</> : "Sem conta vinculada. Crie o usuário em Usuários (papel Voluntário) e informe o e-mail aqui."}</p>
          <Reveal label={p.linkedEmail ? "Alterar vínculo" : "Vincular conta"} variant="secondary">
            <EntityForm action={`/api/people/${p.id}/account`} method="PUT" submitLabel="Salvar vínculo" initial={{ email: p.linkedEmail ?? "" }} fields={[{ name: "email", label: "E-mail da conta (vazio para desvincular)", type: "email", span: 2 }]} />
          </Reveal>
        </section>
      )}

      <section className="card space-y-3 p-6">
        <h2 className="text-sm font-semibold text-slate-700">Qualificações, habilitações, certificados e treinamentos</h2>
        {p.credentials.length === 0 ? <p className="text-sm text-slate-500">Nenhum registro.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {p.credentials.map((c) => {
              const expired = c.expiryDate && c.expiryDate.toISOString().slice(0, 10) < today;
              return (
                <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">{c.name} {c.status === "INATIVO" && <Badge>inativo</Badge>} {expired && <Badge tone="red">vencido</Badge>}</p>
                    <p className="text-xs text-slate-500">{CREDENTIAL_KIND[c.kind]}{c.issuer ? ` · ${c.issuer}` : ""}{c.number ? ` · nº ${c.number}` : ""} · validade {formatDay(c.expiryDate)}{c.document ? ` · documento: ${c.document.title}` : ""}</p>
                    <p className="text-xs">{c.verifiedAt ? <span className="text-green-800">Conferido em {formatDateTime(c.verifiedAt)} — fonte: {c.verificationSource}</span> : <span className="text-amber-800">Não conferido em fonte oficial</span>}</p>
                  </div>
                  {p.canManage && (
                    <div className="flex flex-wrap gap-2">
                      {!c.verifiedAt && (
                        <Reveal label="Registrar conferência" variant="secondary">
                          <EntityForm action={`/api/people/${p.id}/credentials/${c.id}`} method="PATCH" submitLabel="Registrar" fields={[{ name: "verifySource", label: "Fonte consultada (ex.: sistema do conselho, documento original)", required: true, span: 2, maxLength: 300 }]} />
                        </Reveal>
                      )}
                      <ActionButton label={c.status === "ATIVO" ? "Inativar" : "Reativar"} variant="ghost" action={`/api/people/${p.id}/credentials/${c.id}`} method="PATCH" body={{ status: c.status === "ATIVO" ? "INATIVO" : "ATIVO" }} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {p.canManage && (
          <Reveal label="Adicionar registro">
            <EntityForm
                action={`/api/people/${p.id}/credentials`}
               
                fields={[
                  { name: "kind", label: "Tipo", type: "select", required: true, options: opts(CREDENTIAL_KIND) },
                  { name: "name", label: "Nome", required: true, maxLength: 200 },
                  { name: "issuer", label: "Emissor / conselho", maxLength: 200 },
                  { name: "number", label: "Número", maxLength: 100 },
                  { name: "issueDate", label: "Emissão", type: "date" },
                  { name: "expiryDate", label: "Validade", type: "date" },
                  { name: "documentId", label: "Documento comprobatório", type: "select", options: docs.map((d) => ({ value: d.id, label: d.title })) },
                ]}
              />
          </Reveal>
        )}
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-sm font-semibold text-slate-700">Obras vinculadas</h2>
        {p.assignments.length === 0 ? <p className="text-sm text-slate-500">Nenhum vínculo.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {p.assignments.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium"><Link href={`/obras/${a.work.id}`} className="text-brand-700 hover:underline">{a.work.code}</Link> — {a.work.title} {a.status === "INATIVO" && <Badge>encerrado</Badge>}</p>
                  <p className="text-xs text-slate-500">{a.role} · {formatDay(a.startDate)} a {formatDay(a.endDate)}</p>
                  <p className="text-xs">{a.safetyBriefingAt ? <span className="text-green-800">Integração de segurança em {formatDay(a.safetyBriefingAt)}{a.safetyBriefingNote ? ` — ${a.safetyBriefingNote}` : ""}</span> : <span className="text-amber-800">Integração de segurança não registrada</span>}</p>
                </div>
                {p.canManage && a.status === "ATIVO" && (
                  <Reveal label="Atualizar" variant="secondary">
                    <EntityForm
                        action={`/api/people/${p.id}/assignments/${a.id}`}
                        method="PATCH"
                       
                        initial={{ safetyBriefingAt: toInputDate(a.safetyBriefingAt), safetyBriefingNote: a.safetyBriefingNote ?? "", endDate: toInputDate(a.endDate), status: a.status }}
                        fields={[
                          { name: "safetyBriefingAt", label: "Data da integração de segurança", type: "date" },
                          { name: "endDate", label: "Término do vínculo", type: "date" },
                          { name: "safetyBriefingNote", label: "Conteúdo/registro da orientação", type: "textarea", maxLength: 1000 },
                          { name: "status", label: "Situação", type: "select", required: true, options: [{ value: "ATIVO", label: "Ativo" }, { value: "INATIVO", label: "Encerrado" }] },
                        ]}
                      />
                  </Reveal>
                )}
              </li>
            ))}
          </ul>
        )}
        {p.status === "ATIVO" && openWorks.length > 0 && (p.canManage || openWorks.some((w) => can(actor, "work.manage", w.unitPath))) && (
          <Reveal label="Vincular a uma obra">
            <EntityForm
                action={`/api/people/${p.id}/assignments`}
               
                initial={{ startDate: today }}
                fields={[
                  { name: "workId", label: "Obra", type: "select", required: true, options: openWorks.map((w) => ({ value: w.id, label: `${w.code} — ${w.title}` })) },
                  { name: "role", label: "Função na obra", required: true, maxLength: 120 },
                  { name: "startDate", label: "Início", type: "date", required: true },
                  { name: "endDate", label: "Término previsto", type: "date" },
                  { name: "safetyBriefingAt", label: "Integração de segurança realizada em", type: "date" },
                  { name: "safetyBriefingNote", label: "Registro da orientação", type: "textarea", maxLength: 1000 },
                  { name: "activities", label: "Atividades que exercerá", type: "multi", options: activities.map((x) => ({ value: x.code, label: x.name })) },
                ]}
              />
          </Reveal>
        )}
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-sm font-semibold text-slate-700">EPIs recebidos</h2>
        {p.epiDeliveries.length === 0 ? <p className="text-sm text-slate-500">Nenhuma entrega registrada.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {p.epiDeliveries.map((d) => (
              <li key={d.id} className="py-2">
                {formatDay(d.deliveredAt)} · {d.quantity}× {d.catalog.name}{d.catalog.caNumber ? ` (CA ${d.catalog.caNumber})` : ""} · recebimento: {RECEIPT[d.receipt]}
                {d.returnedAt && <span className="text-slate-500"> · devolvido {d.returnedQuantity} em {formatDay(d.returnedAt)}</span>}
              </li>
            ))}
          </ul>
        )}
        <Link href="/epis?aba=entregas" className="text-sm text-brand-700 hover:underline">Registrar entrega na tela de EPIs</Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Documentos da pessoa</h2>
        <Alert tone="warning">Não envie exames, laudos, atestados médicos ou prontuários aqui. O ASO tem registro próprio e restrito na seção “Saúde ocupacional”.</Alert>
        <DocumentsPanel uploadPath={`/api/people/${p.id}/documents`} documents={serialize(docs.filter((d) => !d.sensitive))} categories={categories.filter((c) => c.code !== "ASO")} canUpload={can(actor, "document.upload", p.unitPath)} canReview={can(actor, "document.review", p.unitPath)} userId={actor.userId} />
      </section>
    </div>
  );
}
