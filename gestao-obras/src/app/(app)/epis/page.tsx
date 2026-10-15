import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/server/auth/page-context";
import { can, canAnywhere } from "@/server/authz/authorize";
import { listCatalog, listDeliveries, listMovements, stockBalances } from "@/server/services/epi.service";
import { listOrgUnits, getRootUnit } from "@/server/services/org-unit.service";
import { listPeople } from "@/server/services/people.service";
import { listWorks, listWorkCatalogs } from "@/server/services/work.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { Tabs } from "@/components/ui/Tabs";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { EntityForm, Reveal } from "@/components/ui/EntityForm";
import { RECEIPT, opts } from "@/components/phase3/labels";
import { formatDateTime, formatDay, toInputDate } from "@/lib/format";

export const metadata: Metadata = { title: "EPIs" };
const TABS = ["estoque", "entregas", "catalogo", "movimentacoes"] as const;

export default async function EpiPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "epi.read")) return <Forbidden />;
  const { aba } = await searchParams;
  const tab = TABS.find((t) => t === aba) ?? "estoque";
  const [catalog, balances, units, root] = await Promise.all([listCatalog(actor, { includeInactive: true }), stockBalances(actor), listOrgUnits(actor, { status: "ATIVA" }), getRootUnit()]);
  const stockUnits = units.filter((u) => can(actor, "epi.stock", u.path));
  const activeCatalog = catalog.filter((c) => c.status === "ATIVO");
  const canCatalog = Boolean(root && can(actor, "epi.manage", root.path));
  const today = new Date().toISOString().slice(0, 10);
  const catFields = await catalogFields();

  return (
    <div className="space-y-4">
      <PageHeader title="EPIs" description="Catálogo, estoque por unidade e registro individual de entregas e devoluções." />
      <Alert tone="info">A escolha do EPI deve seguir a análise dos riscos da atividade e as exigências aplicáveis; a existência de um CA, por si só, não garante a adequação.</Alert>
      <Tabs base="/epis" current={tab} tabs={[{ id: "estoque", label: "Estoque" }, { id: "entregas", label: "Entregas" }, { id: "catalogo", label: "Catálogo", count: activeCatalog.length }, { id: "movimentacoes", label: "Movimentações" }]} />

      {tab === "estoque" && (
        <div className="space-y-4">
          {stockUnits.length > 0 && activeCatalog.length > 0 && (
            <Reveal label="Registrar entrada, baixa ou ajuste">
              <EntityForm
                  action="/api/epi/stock"
                 
                  successMessage="Movimentação registrada."
                  fields={[
                    { name: "catalogId", label: "EPI", type: "select", required: true, options: activeCatalog.map((c) => ({ value: c.id, label: `${c.name}${c.size ? ` (${c.size})` : ""}` })) },
                    { name: "unitId", label: "Local de estoque", type: "select", required: true, options: stockUnits.map((u) => ({ value: u.id, label: `${"— ".repeat(u.depth)}${u.name}` })) },
                    { name: "type", label: "Tipo", type: "select", required: true, options: [{ value: "ENTRADA", label: "Entrada" }, { value: "BAIXA", label: "Baixa (descarte/perda)" }, { value: "AJUSTE", label: "Ajuste de inventário (±)" }] },
                    { name: "quantity", label: "Quantidade", type: "number", required: true },
                    { name: "lot", label: "Lote", maxLength: 60 },
                    { name: "expiryDate", label: "Validade do lote", type: "date" },
                    { name: "note", label: "Observação (obrigatória para ajuste)", type: "textarea", maxLength: 500 },
                  ]}
                />
            </Reveal>
          )}
          {balances.length === 0 ? <EmptyState title="Nenhum estoque registrado" description="Registre uma entrada para começar a controlar o saldo de uma unidade." /> : (
            <div className="card overflow-x-auto">
              <table className="table-base">
                <thead><tr><th>Local</th><th>EPI</th><th>CA</th><th className="text-right">Saldo</th><th className="text-right">Mínimo</th><th>Situação</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {balances.map((b) => (
                    <tr key={`${b.catalogId}:${b.unitId}`}>
                      <td>{b.unitName}</td>
                      <td>{b.name}</td>
                      <td>{b.caNumber ?? "—"}{b.caExpiry && b.caExpiry.toISOString().slice(0, 10) < today && <> <Badge tone="red">CA vencido</Badge></>}</td>
                      <td className="text-right tabular-nums">{b.balance}</td>
                      <td className="text-right tabular-nums">{b.minStock}</td>
                      <td>{b.balance < b.minStock ? <Badge tone="red">abaixo do mínimo</Badge> : <Badge tone="green">adequado</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "entregas" && <Deliveries actorUnits={stockUnits} catalog={activeCatalog} />}

      {tab === "catalogo" && (
        <div className="space-y-4">
          {canCatalog && (
            <Reveal label="Incluir EPI no catálogo">
              <EntityForm action="/api/epi/catalog" initial={{ status: "ATIVO", minStock: "0" }} fields={catFields} />
            </Reveal>
          )}
          {catalog.length === 0 ? <EmptyState title="Catálogo vazio" /> : (
            <ul className="space-y-2">
              {catalog.map((c) => (
                <li key={c.id} className="card p-4 text-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                    <div>
                      <p className="font-medium">{c.name} {c.status === "INATIVO" && <Badge>inativo</Badge>}</p>
                      <p className="text-xs text-slate-500">{c.epiType} · {c.manufacturer ?? "fabricante não informado"}{c.model ? ` · ${c.model}` : ""}{c.size ? ` · tamanho ${c.size}` : ""} · CA {c.caNumber ?? "não aplicável/informado"} (validade {formatDay(c.caExpiry)}) · mínimo {c.minStock}</p>
                    </div>
                    {canCatalog && (
                      <Reveal label="Editar" variant="secondary">
                        <EntityForm
                            action={`/api/epi/catalog/${c.id}`}
                            method="PUT"
                           
                            initial={{ name: c.name, epiType: c.epiType, manufacturer: c.manufacturer ?? "", model: c.model ?? "", size: c.size ?? "", caNumber: c.caNumber ?? "", caExpiry: toInputDate(c.caExpiry), shelfLifeMonths: c.shelfLifeMonths?.toString() ?? "", minStock: String(c.minStock), indicatedFor: c.indicatedFor, status: c.status }}
                            fields={catFields}
                          />
                      </Reveal>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "movimentacoes" && <Movements />}
    </div>
  );

  async function catalogFields() {
    const { activities } = await listWorkCatalogs();
    return [
      { name: "name", label: "Nome", required: true, maxLength: 200 },
      { name: "epiType", label: "Tipo de proteção", required: true, maxLength: 120 },
      { name: "manufacturer", label: "Fabricante", maxLength: 200 },
      { name: "model", label: "Modelo", maxLength: 120 },
      { name: "size", label: "Tamanho", maxLength: 30 },
      { name: "caNumber", label: "Número do CA (quando aplicável)", maxLength: 10 },
      { name: "caExpiry", label: "Validade do CA", type: "date" as const },
      { name: "shelfLifeMonths", label: "Vida útil (meses)", type: "number" as const },
      { name: "minStock", label: "Estoque mínimo por unidade", type: "number" as const },
      { name: "status", label: "Situação", type: "select" as const, required: true, options: [{ value: "ATIVO", label: "Ativo" }, { value: "INATIVO", label: "Inativo" }] },
      { name: "indicatedFor", label: "Indicado para as atividades", type: "multi" as const, options: activities.map((a) => ({ value: a.code, label: a.name })) },
    ];
  }

  async function Deliveries({ actorUnits, catalog: cat }: { actorUnits: typeof stockUnits; catalog: typeof activeCatalog }) {
    const [deliveries, people, works] = await Promise.all([listDeliveries(actor), listPeople(actor, { status: "ATIVO" }), listWorks(actor)]);
    return (
      <div className="space-y-4">
        {actorUnits.length > 0 && cat.length > 0 && (
          <Reveal label="Registrar entrega">
            <EntityForm
                action="/api/epi/deliveries"
               
                successMessage="Entrega registrada e baixada do estoque."
                initial={{ deliveredAt: today, receipt: "PENDENTE" }}
                fields={[
                  { name: "personId", label: "Pessoa", type: "select", required: true, options: people.map((p) => ({ value: p.id, label: p.name })) },
                  { name: "catalogId", label: "EPI", type: "select", required: true, options: cat.map((c) => ({ value: c.id, label: c.name })) },
                  { name: "unitId", label: "Estoque de origem", type: "select", required: true, options: actorUnits.map((u) => ({ value: u.id, label: u.name })) },
                  { name: "workId", label: "Obra", type: "select", options: works.map((w) => ({ value: w.id, label: `${w.code} — ${w.title}` })) },
                  { name: "quantity", label: "Quantidade", type: "number", required: true },
                  { name: "deliveredAt", label: "Data", type: "date", required: true },
                  { name: "lot", label: "Lote", maxLength: 60 },
                  { name: "receipt", label: "Confirmação de recebimento", type: "select", required: true, options: opts(RECEIPT), hint: "O sistema não simula assinatura. Registre como a confirmação foi feita." },
                  { name: "receiptNote", label: "Observação", type: "textarea", maxLength: 500 },
                  { name: "replacesId", label: "Substitui a entrega", type: "select", options: deliveries.filter((d) => !d.returnedAt).map((d) => ({ value: d.id, label: `${formatDay(d.deliveredAt)} — ${d.person.name} — ${d.catalog.name}` })) },
                  { name: "replacementReason", label: "Motivo da substituição", maxLength: 300 },
                ]}
              />
          </Reveal>
        )}
        {deliveries.length === 0 ? <EmptyState title="Nenhuma entrega registrada" /> : (
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Data</th><th>Pessoa</th><th>EPI</th><th className="text-right">Qtd.</th><th>Obra</th><th>Recebimento</th><th>Devolução</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap">{formatDay(d.deliveredAt)}</td>
                    <td><Link href={`/pessoas/${d.person.id}`} className="text-brand-700 hover:underline">{d.person.name}</Link></td>
                    <td>{d.catalog.name}{d.catalog.caNumber ? <span className="block text-xs text-slate-500">CA {d.catalog.caNumber}</span> : null}{d.replacementReason && <span className="block text-xs text-slate-500">substituição: {d.replacementReason}</span>}</td>
                    <td className="text-right tabular-nums">{d.quantity}</td>
                    <td>{d.work?.code ?? "—"}</td>
                    <td>{d.receipt === "PENDENTE" ? <Badge tone="amber">pendente</Badge> : RECEIPT[d.receipt]}</td>
                    <td>{d.returnedAt ? `${d.returnedQuantity} em ${formatDay(d.returnedAt)}` : "—"}</td>
                    <td className="space-y-1">
                      {can(actor, "epi.stock", d.unitPath) && d.receipt === "PENDENTE" && (
                        <Reveal label="Confirmar" variant="secondary">
                          <EntityForm action={`/api/epi/deliveries/${d.id}`} method="PATCH" fixed={{ action: "confirmar" }} fields={[{ name: "receipt", label: "Forma", type: "select", required: true, options: opts(RECEIPT).filter((o) => o.value !== "PENDENTE") }, { name: "receiptNote", label: "Observação", maxLength: 500 }]} />
                        </Reveal>
                      )}
                      {can(actor, "epi.stock", d.unitPath) && !d.returnedAt && (
                        <Reveal label="Devolver" variant="secondary">
                          <EntityForm action={`/api/epi/deliveries/${d.id}`} method="PATCH" fixed={{ action: "devolver" }} initial={{ returnedAt: today, returnedQuantity: String(d.quantity) }} fields={[{ name: "returnedAt", label: "Data", type: "date", required: true }, { name: "returnedQuantity", label: "Quantidade", type: "number", required: true }, { name: "returnCondition", label: "Condição", required: true, maxLength: 300 }, { name: "restock", label: "Retornar ao estoque (em condições de uso)", type: "checkbox" }]} />
                        </Reveal>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  async function Movements() {
    const movements = await listMovements(actor);
    const TYPE: Record<string, string> = { ENTRADA: "Entrada", ENTREGA: "Entrega", DEVOLUCAO: "Devolução", BAIXA: "Baixa", AJUSTE: "Ajuste" };
    return movements.length === 0 ? <EmptyState title="Nenhuma movimentação" /> : (
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Data/hora</th><th>Local</th><th>EPI</th><th>Tipo</th><th className="text-right">Qtd.</th><th>Lote</th><th>Observação</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {movements.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                <td>{m.unit.name}</td>
                <td>{m.catalog.name}</td>
                <td>{TYPE[m.type]}</td>
                <td className={`text-right tabular-nums ${m.quantity < 0 ? "text-red-700" : "text-green-800"}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                <td>{m.lot ?? "—"}</td>
                <td>{m.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}
