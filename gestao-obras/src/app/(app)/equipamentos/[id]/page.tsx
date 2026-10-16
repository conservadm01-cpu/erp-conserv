import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/page-context";
import { can } from "@/server/authz/authorize";
import { getEquipment } from "@/server/services/equipment.service";
import { listCategories, listOwnerDocuments } from "@/server/services/document.service";
import { orNotFound } from "@/server/http/page-guard";
import { uuid } from "@/server/validation/common";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EntityForm, Reveal } from "@/components/ui/EntityForm";
import { DocumentsPanel } from "@/components/works/DocumentsPanel";
import { EQUIPMENT_KIND, EQUIPMENT_STATUS, opts } from "@/components/phase3/labels";
import { formatDay, serialize } from "@/lib/format";

export const metadata: Metadata = { title: "Equipamento" };
const LOG: Record<string, string> = { INSPECAO: "Inspeção", MANUTENCAO: "Manutenção", DEFEITO: "Defeito" };

export default async function EquipmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor();
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const e = await orNotFound(() => getEquipment(actor, id));
  const [docs, categories] = await Promise.all([listOwnerDocuments(actor, "equipment", e.id, e.unitPath), listCategories()]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={e.name}
        description={<span className="flex flex-wrap items-center gap-2">{EQUIPMENT_KIND[e.kind]}{e.identifier ? ` · ${e.identifier}` : ""} · {e.unit.name} · <Badge tone={e.status === "INTERDITADO" ? "red" : e.status === "DISPONIVEL" ? "green" : "slate"}>{EQUIPMENT_STATUS[e.status]}</Badge></span>}
      />
      <section className="card grid grid-cols-1 gap-3 p-6 text-sm sm:grid-cols-3">
        <p><span className="text-slate-500">Fabricante/modelo:</span> {[e.manufacturer, e.model].filter(Boolean).join(" ") || "—"}</p>
        <p><span className="text-slate-500">Próxima inspeção:</span> {formatDay(e.nextInspectionAt)}{e.inspectionIntervalDays ? ` (a cada ${e.inspectionIntervalDays} dias)` : ""}</p>
        <p><span className="text-slate-500">Próxima manutenção:</span> {formatDay(e.nextMaintenanceAt)}{e.maintenanceIntervalDays ? ` (a cada ${e.maintenanceIntervalDays} dias)` : ""}</p>
      </section>
      {e.canManage && e.status !== "BAIXADO" && (
        <div className="flex flex-wrap gap-2">
          <Reveal label="Registrar inspeção, manutenção ou defeito">
            <EntityForm
                action={`/api/equipment/${e.id}/logs`}
               
                initial={{ date: today, type: "INSPECAO" }}
                fields={[
                  { name: "type", label: "Registro", type: "select", required: true, options: opts(LOG) },
                  { name: "date", label: "Data", type: "date", required: true },
                  { name: "approved", label: "Aprovado / em condições de uso", type: "checkbox" },
                  { name: "interdict", label: "Interditar o equipamento (defeito)", type: "checkbox" },
                  { name: "notes", label: "Registro", type: "textarea", required: true, maxLength: 2000 },
                ]}
              />
          </Reveal>
          <Reveal label="Alterar situação" variant="secondary">
            <EntityForm action={`/api/equipment/${e.id}`} method="PATCH" initial={{ status: e.status }} fields={[{ name: "status", label: "Situação", type: "select", required: true, options: opts(EQUIPMENT_STATUS) }, { name: "reason", label: "Justificativa", required: true, maxLength: 500 }]} />
          </Reveal>
        </div>
      )}
      <section className="card p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Histórico</h2>
        {e.logs.length === 0 ? <p className="text-sm text-slate-500">Nenhum registro.</p> : (
          <ol className="space-y-3 text-sm">
            {e.logs.map((l) => (
              <li key={l.id} className="border-l-2 border-slate-200 pl-3">
                <p className="font-medium">{LOG[l.type]} · {formatDay(l.date)} {l.approved === true && <Badge tone="green">aprovado</Badge>}{l.approved === false && <Badge tone="red">reprovado</Badge>}</p>
                <p className="text-slate-700">{l.notes}</p>
                <p className="text-xs text-slate-500">{e.people[l.actorId] ?? "—"}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Documentos (manuais, laudos, certificados)</h2>
        <DocumentsPanel uploadPath={`/api/equipment/${e.id}/documents`} documents={serialize(docs)} categories={categories} canUpload={can(actor, "document.upload", e.unitPath)} canReview={can(actor, "document.review", e.unitPath)} userId={actor.userId} />
      </section>
    </div>
  );
}
