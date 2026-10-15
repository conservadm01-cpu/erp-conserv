import { randomUUID } from "node:crypto";
import { Prisma, type BudgetCategory } from "@prisma/client";
import { prisma, type Db } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCanOnWork, canOnWork, pathWhere, workScopedWhere, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import type { z } from "zod";
import type { budgetLineSchema, budgetSchema, costEntrySchema, measurementSchema } from "../validation/phase4";
import { openSubjectApproval } from "./approval.service";
import { getSetting } from "./settings.service";

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;
const auditActor = (a: Actor) => ({ userId: a.userId, email: a.email });
export const CATEGORIES: BudgetCategory[] = ["MATERIAIS", "SERVICOS", "MAO_DE_OBRA", "LOCACOES", "OUTRAS"];
const lineTotal = (l: { quantity: Dec; unitPrice: Dec }) => l.quantity.mul(l.unitPrice).toDecimalPlaces(2);
const brl = (v: Dec | number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function loadWork(actor: Actor, workId: string, manage = false) {
  const work = await prisma.work.findUnique({ where: { id: workId } });
  if (!work || !canOnWork(actor, "budget.read", work)) throw Errors.notFound("Obra");
  if (manage) {
    assertCanOnWork(actor, "budget.manage", work, "Você não pode alterar o orçamento desta obra.");
    if (["ARQUIVADA", "REJEITADA"].includes(work.status)) throw Errors.conflict("Esta obra não aceita alterações financeiras.");
  }
  return work;
}

// ---------------------------------------------------------------------------
// Orçamento (versões)
// ---------------------------------------------------------------------------

export async function listBudgets(actor: Actor, workId: string) {
  await loadWork(actor, workId);
  return prisma.budget.findMany({ where: { workId }, include: { lines: { orderBy: [{ sortOrder: "asc" }] } }, orderBy: { version: "desc" } });
}

/** Cria nova versão em rascunho; por padrão copia as linhas do orçamento aprovado vigente. */
export async function createBudget(actor: Actor, workId: string, input: z.infer<typeof budgetSchema>, meta: RequestMeta) {
  const work = await loadWork(actor, workId, true);
  if (await prisma.budget.findFirst({ where: { workId, status: { in: ["RASCUNHO", "EM_APROVACAO"] } } })) throw Errors.conflict("Já existe uma versão em elaboração ou em aprovação.");
  const approved = await prisma.budget.findFirst({ where: { workId, status: "APROVADO" }, include: { lines: true } });
  if (input.contractId && !(await prisma.contract.findFirst({ where: { id: input.contractId, workId } }))) throw Errors.invalid("Contrato/aditivo inválido.", { contractId: ["Selecione um contrato desta obra."] });
  return prisma.$transaction(async (tx) => {
    const last = await tx.budget.findFirst({ where: { workId }, orderBy: { version: "desc" } });
    const b = await tx.budget.create({
      data: {
        workId, version: (last?.version ?? 0) + 1, reason: input.reason, contractId: input.contractId ?? null, createdById: actor.userId,
        lines: input.copyFromApproved && approved ? { create: approved.lines.map((l) => ({ lineKey: l.lineKey, sortOrder: l.sortOrder, category: l.category, description: l.description, unit: l.unit, quantity: l.quantity, unitPrice: l.unitPrice, companyId: l.companyId })) } : undefined,
        total: input.copyFromApproved && approved ? approved.total : new D(0),
      },
    });
    await recordAudit({ action: "orcamento.versao.criada", actor: auditActor(actor), objectType: "Budget", objectId: b.id, unitPath: work.unitPath, metadata: { obra: work.code, versao: b.version, motivo: input.reason, copiouAprovado: Boolean(input.copyFromApproved && approved) } }, meta, tx);
    return b;
  });
}

async function loadDraft(actor: Actor, workId: string, budgetId: string) {
  const work = await loadWork(actor, workId, true);
  const b = await prisma.budget.findFirst({ where: { id: budgetId, workId } });
  if (!b) throw Errors.notFound("Orçamento");
  if (b.status !== "RASCUNHO") throw Errors.conflict("Somente versões em rascunho podem ser alteradas.");
  return { work, b };
}

async function recomputeTotal(db: Db, budgetId: string) {
  const lines = await db.budgetLine.findMany({ where: { budgetId } });
  const total = lines.reduce((s, l) => s.add(lineTotal(l)), new D(0));
  await db.budget.update({ where: { id: budgetId }, data: { total } });
  return total;
}

export async function saveBudgetLine(actor: Actor, workId: string, budgetId: string, lineId: string | null, input: z.infer<typeof budgetLineSchema>, meta: RequestMeta) {
  const { work, b } = await loadDraft(actor, workId, budgetId);
  if (input.companyId && !(await prisma.company.findUnique({ where: { id: input.companyId } }))) throw Errors.invalid("Fornecedor inválido.", { companyId: ["Empresa não encontrada."] });
  return prisma.$transaction(async (tx) => {
    const data = { ...input, quantity: new D(input.quantity), unitPrice: new D(input.unitPrice) };
    if (lineId) {
      const r = await tx.budgetLine.updateMany({ where: { id: lineId, budgetId }, data });
      if (r.count !== 1) throw Errors.notFound("Linha");
    } else {
      const max = await tx.budgetLine.aggregate({ where: { budgetId }, _max: { sortOrder: true } });
      await tx.budgetLine.create({ data: { ...data, budgetId, lineKey: randomUUID(), sortOrder: (max._max.sortOrder ?? 0) + 1 } });
    }
    const total = await recomputeTotal(tx, budgetId);
    await recordAudit({ action: "orcamento.linha.salva", actor: auditActor(actor), objectType: "Budget", objectId: b.id, unitPath: work.unitPath, metadata: { obra: work.code, versao: b.version, total: total.toString() } }, meta, tx);
  });
}

export async function deleteBudgetLine(actor: Actor, workId: string, budgetId: string, lineId: string, meta: RequestMeta) {
  const { work, b } = await loadDraft(actor, workId, budgetId);
  return prisma.$transaction(async (tx) => {
    const r = await tx.budgetLine.deleteMany({ where: { id: lineId, budgetId } });
    if (r.count !== 1) throw Errors.notFound("Linha");
    const total = await recomputeTotal(tx, budgetId);
    await recordAudit({ action: "orcamento.linha.removida", actor: auditActor(actor), objectType: "Budget", objectId: b.id, unitPath: work.unitPath, metadata: { obra: work.code, versao: b.version, total: total.toString() } }, meta, tx);
  });
}

export async function submitBudget(actor: Actor, workId: string, budgetId: string, note: string | null, meta: RequestMeta) {
  const { work, b } = await loadDraft(actor, workId, budgetId);
  const lines = await prisma.budgetLine.findMany({ where: { budgetId }, orderBy: { sortOrder: "asc" } });
  if (!lines.length) throw Errors.invalid("Inclua ao menos uma linha antes de submeter.");
  const approved = await prisma.budget.findFirst({ where: { workId, status: "APROVADO" } });
  return prisma.$transaction(async (tx) => {
    const changed = await tx.budget.updateMany({ where: { id: budgetId, status: "RASCUNHO" }, data: { status: "EM_APROVACAO", submittedById: actor.userId, submittedAt: new Date() } });
    if (changed.count !== 1) throw Errors.conflict("A versão foi alterada por outra pessoa.");
    await openSubjectApproval(
      tx, actor, work,
      {
        kind: "ORCAMENTO", subjectId: b.id, amount: Number(b.total), note,
        snapshot: {
          titulo: `Orçamento v${b.version} — ${work.code}`,
          resumo: [["Motivo", b.reason], ["Total", brl(b.total)], ["Orçamento aprovado anterior", approved ? brl(approved.total) : "nenhum"], ["Diferença", approved ? brl(b.total.sub(approved.total)) : "—"]],
          linhas: { colunas: ["Categoria", "Descrição", "Qtd.", "Un.", "Preço unit.", "Total"], valores: lines.map((l) => [l.category, l.description, l.quantity.toString(), l.unit, brl(l.unitPrice), brl(lineTotal(l))]) },
        },
      },
      meta,
    );
    await recordAudit({ action: "orcamento.submetido", actor: auditActor(actor), objectType: "Budget", objectId: b.id, unitPath: work.unitPath, metadata: { obra: work.code, versao: b.version, total: b.total.toString() } }, meta, tx);
  });
}

// ---------------------------------------------------------------------------
// Lançamentos (contratado, comprometido, pago) — registro, sem pagamento automático
// ---------------------------------------------------------------------------

export async function listCosts(actor: Actor, workId: string) {
  await loadWork(actor, workId);
  return prisma.costEntry.findMany({ where: { workId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
}

export async function addCost(actor: Actor, workId: string, input: z.infer<typeof costEntrySchema>, meta: RequestMeta) {
  const work = await loadWork(actor, workId, true);
  if (input.documentId && !(await prisma.document.findFirst({ where: { id: input.documentId, workId } }))) throw Errors.invalid("Documento inválido.", { documentId: ["Selecione um documento desta obra."] });
  if (input.contractId && !(await prisma.contract.findFirst({ where: { id: input.contractId } }))) throw Errors.invalid("Contrato inválido.");
  if (input.lineKey) {
    const line = await prisma.budgetLine.findFirst({ where: { lineKey: input.lineKey, budget: { workId } } });
    if (!line) throw Errors.invalid("Linha do orçamento inválida.", { lineKey: ["Selecione uma linha do orçamento."] });
  }
  // Compromissos de despesa passam pela aprovação central; contratado e pago são registros.
  const needsApproval = input.kind === "COMPROMETIDO";
  return prisma.$transaction(async (tx) => {
    const c = await tx.costEntry.create({ data: { ...input, amount: new D(input.amount), workId, unitPath: work.unitPath, status: needsApproval ? "AGUARDANDO_APROVACAO" : "REGISTRADO", createdById: actor.userId } });
    if (needsApproval) {
      await openSubjectApproval(
        tx, actor, work,
        { kind: "DESPESA", subjectId: c.id, amount: input.amount, note: input.description, snapshot: { titulo: `Despesa — ${work.code}`, resumo: [["Descrição", input.description], ["Categoria", input.category], ["Valor", brl(input.amount)], ["Data", input.date.toISOString().slice(0, 10)]] } },
        meta,
      );
    }
    await recordAudit({ action: `orcamento.lancamento.${input.kind.toLowerCase()}`, actor: auditActor(actor), objectType: "CostEntry", objectId: c.id, unitPath: work.unitPath, metadata: { obra: work.code, valor: input.amount, categoria: input.category } }, meta, tx);
    return c;
  });
}

export async function cancelCost(actor: Actor, workId: string, costId: string, meta: RequestMeta) {
  const work = await loadWork(actor, workId, true);
  const c = await prisma.costEntry.findFirst({ where: { id: costId, workId } });
  if (!c) throw Errors.notFound("Lançamento");
  if (!["REGISTRADO", "AGUARDANDO_APROVACAO"].includes(c.status)) throw Errors.conflict("Este lançamento não pode ser cancelado.");
  return prisma.$transaction(async (tx) => {
    await tx.costEntry.update({ where: { id: costId }, data: { status: "CANCELADO" } });
    await tx.approval.updateMany({ where: { subjectId: costId, status: "PENDENTE" }, data: { status: "CANCELADA", decidedAt: new Date() } });
    await recordAudit({ action: "orcamento.lancamento.cancelado", actor: auditActor(actor), objectType: "CostEntry", objectId: costId, unitPath: work.unitPath, metadata: { obra: work.code, valor: c.amount.toString() } }, meta, tx);
  });
}

// ---------------------------------------------------------------------------
// Medições
// ---------------------------------------------------------------------------

export async function listMeasurements(actor: Actor, workId: string) {
  await loadWork(actor, workId);
  return prisma.measurement.findMany({ where: { workId }, include: { items: true }, orderBy: { number: "desc" } });
}

/** Cria ou altera medição em rascunho; os valores vêm dos preços do orçamento aprovado. */
export async function saveMeasurement(actor: Actor, workId: string, measurementId: string | null, input: z.infer<typeof measurementSchema>, meta: RequestMeta) {
  const work = await loadWork(actor, workId, true);
  const approved = await prisma.budget.findFirst({ where: { workId, status: "APROVADO" }, include: { lines: true } });
  if (!approved) throw Errors.conflict("A medição exige um orçamento aprovado.");
  const items = input.items.filter((i) => i.quantity > 0);
  for (const i of items) if (!approved.lines.some((l) => l.lineKey === i.lineKey)) throw Errors.invalid("Item fora do orçamento aprovado.");
  if (measurementId) {
    const m = await prisma.measurement.findFirst({ where: { id: measurementId, workId } });
    if (!m) throw Errors.notFound("Medição");
    if (m.status !== "RASCUNHO") throw Errors.conflict("Somente medições em rascunho podem ser alteradas.");
  }
  const rows = items.map((i) => {
    const line = approved.lines.find((l) => l.lineKey === i.lineKey)!;
    const qty = new D(i.quantity);
    return { lineKey: i.lineKey, quantity: qty, amount: qty.mul(line.unitPrice).toDecimalPlaces(2), notes: i.notes ?? null };
  });
  const total = rows.reduce((s, r) => s.add(r.amount), new D(0));
  return prisma.$transaction(async (tx) => {
    let m;
    if (measurementId) {
      await tx.measurementItem.deleteMany({ where: { measurementId } });
      m = await tx.measurement.update({ where: { id: measurementId }, data: { periodStart: input.periodStart, periodEnd: input.periodEnd, contractId: input.contractId ?? null, notes: input.notes, total, items: { create: rows } } });
    } else {
      const last = await tx.measurement.findFirst({ where: { workId }, orderBy: { number: "desc" } });
      m = await tx.measurement.create({ data: { workId, number: (last?.number ?? 0) + 1, periodStart: input.periodStart, periodEnd: input.periodEnd, contractId: input.contractId ?? null, notes: input.notes, total, createdById: actor.userId, items: { create: rows } } });
    }
    await recordAudit({ action: "medicao.salva", actor: auditActor(actor), objectType: "Measurement", objectId: m.id, unitPath: work.unitPath, metadata: { obra: work.code, numero: m.number, total: total.toString() } }, meta, tx);
    return m;
  });
}

/** Quantidade já medida (medições aprovadas ou em aprovação) por linha. */
async function measuredByLine(db: Db, workId: string, excludeId?: string) {
  const items = await db.measurementItem.findMany({ where: { measurement: { workId, status: { in: ["APROVADA", "EM_APROVACAO"] }, ...(excludeId ? { id: { not: excludeId } } : {}) } } });
  const map = new Map<string, { qty: Dec; amount: Dec }>();
  for (const i of items) {
    const cur = map.get(i.lineKey) ?? { qty: new D(0), amount: new D(0) };
    map.set(i.lineKey, { qty: cur.qty.add(i.quantity), amount: cur.amount.add(i.amount) });
  }
  return map;
}

export async function submitMeasurement(actor: Actor, workId: string, measurementId: string, note: string | null, meta: RequestMeta) {
  const work = await loadWork(actor, workId, true);
  const m = await prisma.measurement.findFirst({ where: { id: measurementId, workId }, include: { items: true } });
  if (!m) throw Errors.notFound("Medição");
  if (m.status !== "RASCUNHO") throw Errors.conflict("Esta medição não está em rascunho.");
  if (!m.items.length) throw Errors.invalid("Inclua ao menos um item medido.");
  const approved = await prisma.budget.findFirstOrThrow({ where: { workId, status: "APROVADO" }, include: { lines: true } });
  const prior = await measuredByLine(prisma, workId, m.id);
  // Quantidade acumulada acima do orçamento é sinalizada ao aprovador (não bloqueia).
  const over = m.items.flatMap((i) => {
    const line = approved.lines.find((l) => l.lineKey === i.lineKey);
    const acc = (prior.get(i.lineKey)?.qty ?? new D(0)).add(i.quantity);
    return line && acc.gt(line.quantity) ? [`${line.description}: acumulado ${acc.toString()} ${line.unit} > orçado ${line.quantity.toString()} ${line.unit}`] : [];
  });
  return prisma.$transaction(async (tx) => {
    const changed = await tx.measurement.updateMany({ where: { id: m.id, status: "RASCUNHO" }, data: { status: "EM_APROVACAO" } });
    if (changed.count !== 1) throw Errors.conflict("A medição foi alterada por outra pessoa.");
    await openSubjectApproval(
      tx, actor, work,
      {
        kind: "MEDICAO", subjectId: m.id, amount: Number(m.total), note,
        snapshot: {
          titulo: `Medição nº ${m.number} — ${work.code}`,
          resumo: [["Período", `${m.periodStart.toISOString().slice(0, 10)} a ${m.periodEnd.toISOString().slice(0, 10)}`], ["Total medido", brl(m.total)], ["Alertas", over.length ? over.join("; ") : "nenhum"]],
          linhas: { colunas: ["Item", "Qtd. medida", "Un.", "Valor"], valores: m.items.map((i) => { const l = approved.lines.find((x) => x.lineKey === i.lineKey); return [l?.description ?? "—", i.quantity.toString(), l?.unit ?? "", brl(i.amount)]; }) },
        },
      },
      meta,
    );
    await recordAudit({ action: "medicao.submetida", actor: auditActor(actor), objectType: "Measurement", objectId: m.id, unitPath: work.unitPath, metadata: { obra: work.code, numero: m.number, total: m.total.toString(), acimaDoOrcado: over.length } }, meta, tx);
    return { warnings: over };
  });
}

// ---------------------------------------------------------------------------
// Resumo financeiro
// ---------------------------------------------------------------------------

export type BudgetSummary = Awaited<ReturnType<typeof budgetSummary>>;

/** Orçado, contratado, comprometido, medido, pago, saldo e desvios por categoria. */
export async function budgetSummary(db: Db, workId: string) {
  const [approved, costs, measured, threshold] = await Promise.all([
    db.budget.findFirst({ where: { workId, status: "APROVADO" }, include: { lines: true } }),
    db.costEntry.findMany({ where: { workId, status: { in: ["REGISTRADO", "APROVADO"] } } }),
    db.measurementItem.findMany({ where: { measurement: { workId, status: "APROVADA" } } }),
    getSetting("budget.deviationAlertPercent"),
  ]);
  const zero = () => ({ orcado: new D(0), contratado: new D(0), comprometido: new D(0), medido: new D(0), pago: new D(0) });
  const by = new Map(CATEGORIES.map((c) => [c, zero()]));
  for (const l of approved?.lines ?? []) by.get(l.category)!.orcado = by.get(l.category)!.orcado.add(lineTotal(l));
  for (const c of costs) {
    const k = c.kind === "CONTRATADO" ? "contratado" : c.kind === "COMPROMETIDO" ? "comprometido" : "pago";
    by.get(c.category)![k] = by.get(c.category)![k].add(c.amount);
  }
  for (const i of measured) {
    const line = approved?.lines.find((l) => l.lineKey === i.lineKey);
    const cat = line?.category ?? "OUTRAS";
    by.get(cat)!.medido = by.get(cat)!.medido.add(i.amount);
  }
  const rows = CATEGORIES.map((category) => {
    const r = by.get(category)!;
    const realizado = D.max(r.medido, r.contratado.add(r.comprometido));
    const desvio = realizado.sub(r.orcado);
    const pct = r.orcado.gt(0) ? Number(desvio.div(r.orcado).mul(100).toFixed(1)) : realizado.gt(0) ? 100 : 0;
    return { category, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v)])) as Record<keyof ReturnType<typeof zero>, number>, saldo: Number(r.orcado.sub(r.contratado).sub(r.comprometido)), desvio: Number(desvio), desvioPct: pct, alerta: desvio.gt(0) && pct >= threshold };
  });
  const sum = (k: "orcado" | "contratado" | "comprometido" | "medido" | "pago" | "saldo") => rows.reduce((s, r) => s + r[k], 0);
  return { approvedVersion: approved?.version ?? null, threshold, rows, totals: { orcado: sum("orcado"), contratado: sum("contratado"), comprometido: sum("comprometido"), medido: sum("medido"), pago: sum("pago"), saldo: sum("saldo") } };
}

export async function getWorkBudget(actor: Actor, workId: string) {
  const work = await loadWork(actor, workId);
  const [budgets, costs, measurements, summary, measured] = await Promise.all([
    listBudgets(actor, workId), listCosts(actor, workId), listMeasurements(actor, workId), budgetSummary(prisma, workId), measuredByLine(prisma, workId),
  ]);
  const canManage = canOnWork(actor, "budget.manage", work);
  return { work, budgets, costs, measurements, summary, measured: Object.fromEntries([...measured].map(([k, v]) => [k, { qty: Number(v.qty), amount: Number(v.amount) }])), canManage, options: canManage ? await formOptions(actor, workId) : { companies: [], contracts: [] } };
}

/** Opções dos formulários: contratos da obra e empresas ativas visíveis ao ator (somente identificação). */
async function formOptions(actor: Actor, workId: string) {
  const contracts = await prisma.contract.findMany({ where: { workId, status: { in: ["RASCUNHO", "VIGENTE"] } }, include: { company: { select: { id: true, legalName: true } } }, orderBy: { number: "asc" } });
  const scope = pathWhere(actor, "company.read", "unitPath");
  const visible = scope ? await prisma.company.findMany({ where: { AND: [scope, { status: "ATIVO" }] }, select: { id: true, legalName: true }, orderBy: { legalName: "asc" }, take: 500 }) : [];
  const companies = new Map(visible.map((c) => [c.id, c]));
  for (const c of contracts) companies.set(c.company.id, c.company);
  return { companies: [...companies.values()], contracts: contracts.map((c) => ({ id: c.id, number: `${c.number} — ${c.company.legalName}` })) };
}

/** Totais financeiros no escopo do ator (painel consolidado). */
export async function financialTotals(actor: Actor, workWhere: Prisma.WorkWhereInput) {
  const scope = workScopedWhere(actor, "budget.read", "id");
  if (!scope) return null;
  const works = await prisma.work.findMany({ where: { AND: [scope, workWhere] }, select: { id: true } });
  const ids = works.map((w) => w.id);
  if (!ids.length) return { orcado: 0, comprometido: 0, realizado: 0, pago: 0 };
  const [budgets, costs, measured] = await Promise.all([
    prisma.budget.aggregate({ where: { workId: { in: ids }, status: "APROVADO" }, _sum: { total: true } }),
    prisma.costEntry.groupBy({ by: ["kind"], where: { workId: { in: ids }, status: { in: ["REGISTRADO", "APROVADO"] } }, _sum: { amount: true } }),
    prisma.measurement.aggregate({ where: { workId: { in: ids }, status: "APROVADA" }, _sum: { total: true } }),
  ]);
  const k = (kind: string) => Number(costs.find((c) => c.kind === kind)?._sum.amount ?? 0);
  return { orcado: Number(budgets._sum.total ?? 0), comprometido: k("CONTRATADO") + k("COMPROMETIDO"), realizado: Number(measured._sum.total ?? 0), pago: k("PAGO") };
}

/** Visão por obra (tela de orçamentos): orçado aprovado, comprometido, medido e pendências. */
export async function budgetOverview(actor: Actor) {
  const scope = workScopedWhere(actor, "budget.read", "id");
  if (!scope) return [];
  const works = await prisma.work.findMany({ where: { AND: [scope, { status: { notIn: ["ARQUIVADA", "REJEITADA"] } }] }, select: { id: true, code: true, title: true, status: true, unit: { select: { name: true } } }, orderBy: { code: "asc" }, take: 500 });
  const ids = works.map((w) => w.id);
  const [budgets, costs, measured, pending] = await Promise.all([
    prisma.budget.findMany({ where: { workId: { in: ids }, status: "APROVADO" }, select: { workId: true, total: true, version: true } }),
    prisma.costEntry.groupBy({ by: ["workId", "kind"], where: { workId: { in: ids }, status: { in: ["REGISTRADO", "APROVADO"] } }, _sum: { amount: true } }),
    prisma.measurement.groupBy({ by: ["workId"], where: { workId: { in: ids }, status: "APROVADA" }, _sum: { total: true } }),
    prisma.approval.groupBy({ by: ["workId"], where: { workId: { in: ids }, status: "PENDENTE", kind: { in: ["ORCAMENTO", "MEDICAO", "DESPESA"] } }, _count: { _all: true } }),
  ]);
  return works.map((w) => {
    const b = budgets.find((x) => x.workId === w.id);
    const cost = (kind: string) => Number(costs.find((c) => c.workId === w.id && c.kind === kind)?._sum.amount ?? 0);
    const orcado = Number(b?.total ?? 0);
    const comprometido = cost("CONTRATADO") + cost("COMPROMETIDO");
    return {
      ...w, approvedVersion: b?.version ?? null, orcado, comprometido, pago: cost("PAGO"),
      medido: Number(measured.find((m) => m.workId === w.id)?._sum.total ?? 0),
      pendentes: pending.find((p) => p.workId === w.id)?._count._all ?? 0,
      saldo: orcado - comprometido,
    };
  });
}
