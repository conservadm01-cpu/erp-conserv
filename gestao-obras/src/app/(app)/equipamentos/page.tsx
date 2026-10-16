import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/server/auth/page-context";
import { can, canAnywhere } from "@/server/authz/authorize";
import { listEquipment } from "@/server/services/equipment.service";
import { listOrgUnits } from "@/server/services/org-unit.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { EntityForm, Reveal } from "@/components/ui/EntityForm";
import { EQUIPMENT_KIND, EQUIPMENT_STATUS, opts } from "@/components/phase3/labels";
import { formatDay } from "@/lib/format";

export const metadata: Metadata = { title: "Equipamentos" };

export default async function EquipmentPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "equipment.read")) return <Forbidden />;
  const { q } = await searchParams;
  const [items, units] = await Promise.all([listEquipment(actor, { q: q?.slice(0, 100) || undefined }), listOrgUnits(actor, { status: "ATIVA" })]);
  const manageUnits = units.filter((u) => can(actor, "equipment.manage", u.path));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-4">
      <PageHeader title="Ferramentas e equipamentos" description="Ferramentas, máquinas e equipamentos de proteção coletiva, com inspeções e manutenções." />
      {manageUnits.length > 0 && (
        <Reveal label="Cadastrar equipamento">
          <EntityForm
              action="/api/equipment"
              onDone="/equipamentos/:id"
             
              fields={[
                { name: "kind", label: "Tipo", type: "select", required: true, options: opts(EQUIPMENT_KIND) },
                { name: "name", label: "Nome", required: true, maxLength: 200 },
                { name: "identifier", label: "Patrimônio / nº de série", maxLength: 80 },
                { name: "unitId", label: "Unidade", type: "select", required: true, options: manageUnits.map((u) => ({ value: u.id, label: `${"— ".repeat(u.depth)}${u.name}` })) },
                { name: "manufacturer", label: "Fabricante", maxLength: 200 },
                { name: "model", label: "Modelo", maxLength: 120 },
                { name: "inspectionIntervalDays", label: "Intervalo entre inspeções (dias)", type: "number" },
                { name: "maintenanceIntervalDays", label: "Intervalo entre manutenções (dias)", type: "number" },
                { name: "nextInspectionAt", label: "Próxima inspeção", type: "date" },
                { name: "nextMaintenanceAt", label: "Próxima manutenção", type: "date" },
              ]}
            />
        </Reveal>
      )}
      <form className="flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">Buscar</label>
        <input id="q" name="q" defaultValue={q} placeholder="Nome ou identificação" className="input max-w-sm" />
        <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Buscar</button>
      </form>
      {items.length === 0 ? <EmptyState title="Nenhum equipamento cadastrado" /> : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Equipamento</th><th>Tipo</th><th>Unidade</th><th>Próxima inspeção</th><th>Próxima manutenção</th><th>Situação</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((e) => {
                const late = (d: Date | null) => d && d.toISOString().slice(0, 10) < today;
                return (
                  <tr key={e.id}>
                    <td><Link href={`/equipamentos/${e.id}`} className="font-medium text-brand-700 hover:underline">{e.name}</Link>{e.identifier && <span className="block text-xs text-slate-500">{e.identifier}</span>}</td>
                    <td>{EQUIPMENT_KIND[e.kind]}</td>
                    <td>{e.unit.name}</td>
                    <td className={late(e.nextInspectionAt) ? "text-red-700" : ""}>{formatDay(e.nextInspectionAt)}</td>
                    <td className={late(e.nextMaintenanceAt) ? "text-red-700" : ""}>{formatDay(e.nextMaintenanceAt)}</td>
                    <td><Badge tone={e.status === "INTERDITADO" ? "red" : e.status === "DISPONIVEL" ? "green" : "slate"}>{EQUIPMENT_STATUS[e.status]}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
