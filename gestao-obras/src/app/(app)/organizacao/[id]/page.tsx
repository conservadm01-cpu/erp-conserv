import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/server/auth/page-context";
import { can } from "@/server/authz/authorize";
import { getOrgUnit, listOrgUnits, listOrgUnitTypes } from "@/server/services/org-unit.service";
import { orNotFound } from "@/server/http/page-guard";
import { uuid } from "@/server/validation/common";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { OrgUnitForm } from "@/components/org/OrgUnitForm";
import { OrgUnitStatusButton } from "@/components/org/OrgUnitStatusButton";
import { OrgUnitRemoveButton } from "@/components/org/OrgUnitRemoveButton";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Unidade" };

export default async function OrgUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor();
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const unit = await orNotFound(() => getOrgUnit(actor, id));
  const [units, types] = await Promise.all([listOrgUnits(actor), listOrgUnitTypes()]);
  const children = units.filter((u) => u.parentId === unit.id);
  const type = types.find((t) => t.code === unit.typeCode);
  const parents = units
    .filter((u) => u.status === "ATIVA" && can(actor, "org.manage", u.path) && !u.path.startsWith(unit.path) && type?.allowedParentCodes.includes(u.typeCode))
    .map(({ id, name, code, typeCode, depth }) => ({ id, name, code, typeCode, depth }));
  if (unit.parent && !parents.some((p) => p.id === unit.parent!.id)) {
    const current = units.find((u) => u.id === unit.parent!.id);
    parents.unshift({ id: unit.parent.id, name: unit.parent.name, code: unit.parent.code, typeCode: current?.typeCode ?? "", depth: current?.depth ?? 0 });
  }
  const canAddChild = unit.canManage && unit.status === "ATIVA" && types.some((t) => t.allowedParentCodes.includes(unit.typeCode));

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={unit.name}
        description={<span className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs">{unit.code}</span> · {unit.type.name} · <StatusBadge status={unit.status} />{unit.parent && <> · subordinada a <Link className="text-brand-700 hover:underline" href={`/organizacao/${unit.parent.id}`}>{unit.parent.name}</Link></>}</span>}
        actions={
          <>
            {canAddChild && <Link href={`/organizacao/nova?parentId=${unit.id}`} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Nova subordinada</Link>}
            {unit.canManage && unit.depth > 0 && <OrgUnitStatusButton unitId={unit.id} status={unit.status} />}
            {unit.parent && can(actor, "org.manage", units.find((u) => u.id === unit.parent!.id)?.path ?? "#") && children.length === 0 && <OrgUnitRemoveButton unitId={unit.id} />}
          </>
        }
      />

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">{unit.canManage ? "Dados da unidade" : "Dados da unidade (somente leitura)"}</h2>
        {unit.canManage ? (
          <OrgUnitForm
            mode="edit"
            unitId={unit.id}
            parents={parents}
            types={types}
            initial={{
              code: unit.code, name: unit.name, typeCode: unit.typeCode, parentId: unit.parentId ?? "",
              street: unit.street ?? "", number: unit.number ?? "", complement: unit.complement ?? "", district: unit.district ?? "",
              city: unit.city ?? "", state: unit.state ?? "", postalCode: unit.postalCode ?? "",
              contacts: unit.contacts.map((c) => ({ name: c.name, role: c.role ?? "", email: c.email ?? "", phone: c.phone ?? "" })),
            }}
          />
        ) : (
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Endereço</dt><dd>{[unit.street, unit.number, unit.complement, unit.district].filter(Boolean).join(", ") || "—"}</dd></div>
            <div><dt className="text-slate-500">Cidade/UF</dt><dd>{[unit.city, unit.state].filter(Boolean).join("/") || "—"}</dd></div>
            <div><dt className="text-slate-500">CEP</dt><dd>{unit.postalCode ?? "—"}</dd></div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Contatos autorizados</dt>
              <dd>{unit.contacts.length ? <ul>{unit.contacts.map((c) => <li key={c.id}>{c.name}{c.role ? ` — ${c.role}` : ""}{c.email ? ` · ${c.email}` : ""}{c.phone ? ` · ${c.phone}` : ""}</li>)}</ul> : "—"}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="card p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Unidades subordinadas ({children.length})</h2>
        {children.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma unidade subordinada visível.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {children.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <Link href={`/organizacao/${c.id}`} className="text-brand-700 hover:underline">{c.name}</Link>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
