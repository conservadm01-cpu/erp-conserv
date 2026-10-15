import { prisma, type Tx } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCan, can, canAnywhere, canOnWork, pathWhere, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import type { z } from "zod";
import type { deliverySchema, epiCatalogSchema, receiptSchema, returnSchema, stockMovementSchema } from "../validation/phase3";
import { getRootUnit } from "./org-unit.service";
import { startOfToday } from "./requirement.service";

const auditActor = (a: Actor) => ({ userId: a.userId, email: a.email });

async function assertCatalogAdmin(actor: Actor) {
  const root = await getRootUnit();
  if (!root) throw Errors.conflict("Estrutura organizacional não inicializada.");
  assertCan(actor, "epi.manage", root.path, "O catálogo de EPIs é mantido pela gestão central.");
}

export async function listCatalog(actor: Actor, opts: { includeInactive?: boolean } = {}) {
  if (!canAnywhere(actor, "epi.read")) throw Errors.forbidden();
  return prisma.epiCatalog.findMany({ where: opts.includeInactive ? {} : { status: "ATIVO" }, orderBy: { name: "asc" } });
}

export async function createCatalogItem(actor: Actor, input: z.infer<typeof epiCatalogSchema>, meta: RequestMeta) {
  await assertCatalogAdmin(actor);
  return prisma.$transaction(async (tx) => {
    const e = await tx.epiCatalog.create({ data: input });
    await recordAudit({ action: "epi.catalogo.criado", actor: auditActor(actor), objectType: "EpiCatalog", objectId: e.id, metadata: { nome: e.name, ca: e.caNumber } }, meta, tx);
    return e;
  });
}

export async function updateCatalogItem(actor: Actor, id: string, input: z.infer<typeof epiCatalogSchema>, meta: RequestMeta) {
  await assertCatalogAdmin(actor);
  if (!(await prisma.epiCatalog.findUnique({ where: { id } }))) throw Errors.notFound("EPI");
  return prisma.$transaction(async (tx) => {
    const e = await tx.epiCatalog.update({ where: { id }, data: input });
    await recordAudit({ action: "epi.catalogo.alterado", actor: auditActor(actor), objectType: "EpiCatalog", objectId: id, metadata: { campos: Object.keys(input) } }, meta, tx);
    return e;
  });
}

async function lockStock(tx: Tx, catalogId: string, unitId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`epi:${catalogId}:${unitId}`}))`;
}

async function balanceOf(tx: Tx, catalogId: string, unitId: string) {
  const r = await tx.epiStockMovement.aggregate({ where: { catalogId, unitId }, _sum: { quantity: true } });
  return r._sum.quantity ?? 0;
}

/** Saldo por EPI e local de estoque, no escopo do ator. */
export async function stockBalances(actor: Actor) {
  const scope = pathWhere(actor, "epi.read", "unitPath");
  if (!scope) return [];
  const rows = await prisma.epiStockMovement.groupBy({ by: ["catalogId", "unitId"], where: scope, _sum: { quantity: true } });
  const [catalog, units] = await Promise.all([
    prisma.epiCatalog.findMany({ where: { id: { in: rows.map((r) => r.catalogId) } } }),
    prisma.organizationUnit.findMany({ where: { id: { in: rows.map((r) => r.unitId) } }, select: { id: true, name: true, path: true } }),
  ]);
  return rows
    .map((r) => {
      const c = catalog.find((x) => x.id === r.catalogId)!;
      const u = units.find((x) => x.id === r.unitId)!;
      return { catalogId: c.id, name: c.name, caNumber: c.caNumber, caExpiry: c.caExpiry, minStock: c.minStock, unitId: u.id, unitName: u.name, unitPath: u.path, balance: r._sum.quantity ?? 0, canMove: can(actor, "epi.stock", u.path) };
    })
    .sort((a, b) => a.unitName.localeCompare(b.unitName) || a.name.localeCompare(b.name));
}

/** Locais com saldo abaixo do mínimo (usado pelos alertas). */
export async function lowStock() {
  const rows = await prisma.epiStockMovement.groupBy({ by: ["catalogId", "unitId", "unitPath"], _sum: { quantity: true } });
  const catalog = await prisma.epiCatalog.findMany({ where: { status: "ATIVO", minStock: { gt: 0 } } });
  const units = await prisma.organizationUnit.findMany({ where: { id: { in: rows.map((r) => r.unitId) } }, select: { id: true, name: true } });
  return rows
    .map((r) => ({ r, c: catalog.find((c) => c.id === r.catalogId) }))
    .filter(({ r, c }) => c && (r._sum.quantity ?? 0) < c.minStock)
    .map(({ r, c }) => ({ catalogId: r.catalogId, unitId: r.unitId, unitPath: r.unitPath, unitName: units.find((u) => u.id === r.unitId)?.name ?? "", name: c!.name, minStock: c!.minStock, balance: r._sum.quantity ?? 0 }));
}

async function loadStockUnit(actor: Actor, unitId: string) {
  const unit = await prisma.organizationUnit.findUnique({ where: { id: unitId } });
  if (!unit || !can(actor, "epi.read", unit.path)) throw Errors.notFound("Local de estoque");
  assertCan(actor, "epi.stock", unit.path, "Você não pode movimentar o estoque desta unidade.");
  return unit;
}

export async function addMovement(actor: Actor, input: z.infer<typeof stockMovementSchema>, meta: RequestMeta) {
  const unit = await loadStockUnit(actor, input.unitId);
  const item = await prisma.epiCatalog.findUnique({ where: { id: input.catalogId } });
  if (!item) throw Errors.notFound("EPI");
  if (input.type === "ENTRADA" && input.quantity < 0) throw Errors.invalid("Entradas devem ter quantidade positiva.", { quantity: ["Use um valor positivo."] });
  if (input.type === "AJUSTE" && !input.note) throw Errors.invalid("Ajustes exigem justificativa.", { note: ["Justifique o ajuste."] });
  const quantity = input.type === "BAIXA" ? -Math.abs(input.quantity) : input.quantity;
  return prisma.$transaction(async (tx) => {
    await lockStock(tx, item.id, unit.id);
    const balance = await balanceOf(tx, item.id, unit.id);
    if (balance + quantity < 0) throw Errors.conflict(`Saldo insuficiente: há ${balance} unidade(s) em estoque.`);
    const m = await tx.epiStockMovement.create({ data: { ...input, quantity, expiryDate: input.expiryDate ?? null, unitPath: unit.path, actorId: actor.userId } });
    await recordAudit({ action: "epi.estoque.movimento", actor: auditActor(actor), objectType: "EpiStockMovement", objectId: m.id, unitPath: unit.path, metadata: { epi: item.name, tipo: input.type, quantidade: quantity, saldo: balance + quantity } }, meta, tx);
    return { movement: m, balance: balance + quantity };
  });
}

export async function listMovements(actor: Actor, q: { catalogId?: string; unitId?: string } = {}) {
  const scope = pathWhere(actor, "epi.read", "unitPath");
  if (!scope) return [];
  return prisma.epiStockMovement.findMany({
    where: { AND: [scope, q.catalogId ? { catalogId: q.catalogId } : {}, q.unitId ? { unitId: q.unitId } : {}] },
    include: { catalog: { select: { name: true } }, unit: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
}

export async function deliver(actor: Actor, input: z.infer<typeof deliverySchema>, meta: RequestMeta) {
  const unit = await loadStockUnit(actor, input.unitId);
  const [item, person] = await Promise.all([
    prisma.epiCatalog.findUnique({ where: { id: input.catalogId } }),
    prisma.person.findUnique({ where: { id: input.personId } }),
  ]);
  if (!item || item.status !== "ATIVO") throw Errors.invalid("EPI inválido ou inativo.", { catalogId: ["Selecione um EPI ativo."] });
  if (!person || !can(actor, "person.read", person.unitPath)) throw Errors.notFound("Pessoa");
  if (person.status !== "ATIVO") throw Errors.conflict("A pessoa está inativa.");
  if (input.workId) {
    const w = await prisma.work.findUnique({ where: { id: input.workId } });
    if (!w || !canOnWork(actor, "work.read", w)) throw Errors.invalid("Obra inválida.", { workId: ["Obra não encontrada."] });
  }
  if (input.replacesId && !(await prisma.epiDelivery.findFirst({ where: { id: input.replacesId, personId: person.id } }))) {
    throw Errors.invalid("A entrega substituída deve ser da mesma pessoa.", { replacesId: ["Entrega inválida."] });
  }
  const warnings: string[] = [];
  if (item.caExpiry && item.caExpiry < startOfToday()) warnings.push("O CA cadastrado para este EPI está vencido. Confirme a situação na fonte oficial.");
  return prisma.$transaction(async (tx) => {
    await lockStock(tx, item.id, unit.id);
    const balance = await balanceOf(tx, item.id, unit.id);
    if (balance < input.quantity) throw Errors.conflict(`Saldo insuficiente: há ${balance} unidade(s) em estoque nesta unidade.`);
    const d = await tx.epiDelivery.create({ data: { ...input, unitPath: unit.path, deliveredById: actor.userId } });
    await tx.epiStockMovement.create({ data: { catalogId: item.id, unitId: unit.id, unitPath: unit.path, type: "ENTREGA", quantity: -input.quantity, lot: input.lot, deliveryId: d.id, actorId: actor.userId } });
    await recordAudit(
      { action: "epi.entrega", actor: auditActor(actor), objectType: "EpiDelivery", objectId: d.id, unitPath: unit.path, metadata: { epi: item.name, ca: item.caNumber, quantidade: input.quantity, confirmacao: input.receipt, substitui: input.replacesId ?? undefined } },
      meta,
      tx,
    );
    return { delivery: d, warnings };
  });
}

async function loadDelivery(actor: Actor, id: string) {
  const d = await prisma.epiDelivery.findUnique({ where: { id }, include: { catalog: true } });
  if (!d || !can(actor, "epi.read", d.unitPath)) throw Errors.notFound("Entrega");
  assertCan(actor, "epi.stock", d.unitPath);
  return d;
}

export async function confirmReceipt(actor: Actor, id: string, input: z.infer<typeof receiptSchema>, meta: RequestMeta) {
  const d = await loadDelivery(actor, id);
  return prisma.$transaction(async (tx) => {
    const u = await tx.epiDelivery.update({ where: { id }, data: input });
    await recordAudit({ action: "epi.entrega.confirmada", actor: auditActor(actor), objectType: "EpiDelivery", objectId: id, unitPath: d.unitPath, metadata: { forma: input.receipt } }, meta, tx);
    return u;
  });
}

export async function returnDelivery(actor: Actor, id: string, input: z.infer<typeof returnSchema>, meta: RequestMeta) {
  const d = await loadDelivery(actor, id);
  if (d.returnedAt) throw Errors.conflict("Esta entrega já teve devolução registrada.");
  if (input.returnedQuantity > d.quantity) throw Errors.invalid("A devolução não pode ser maior que a entrega.", { returnedQuantity: ["Quantidade inválida."] });
  return prisma.$transaction(async (tx) => {
    const u = await tx.epiDelivery.update({ where: { id }, data: { returnedAt: input.returnedAt, returnedQuantity: input.returnedQuantity, returnCondition: input.returnCondition } });
    if (input.restock) {
      await lockStock(tx, d.catalogId, d.unitId);
      await tx.epiStockMovement.create({ data: { catalogId: d.catalogId, unitId: d.unitId, unitPath: d.unitPath, type: "DEVOLUCAO", quantity: input.returnedQuantity, deliveryId: d.id, note: input.returnCondition, actorId: actor.userId } });
    }
    await recordAudit({ action: "epi.devolucao", actor: auditActor(actor), objectType: "EpiDelivery", objectId: id, unitPath: d.unitPath, metadata: { quantidade: input.returnedQuantity, retornaEstoque: input.restock, condicao: input.returnCondition } }, meta, tx);
    return u;
  });
}

export async function listDeliveries(actor: Actor, q: { personId?: string; workId?: string } = {}) {
  const scope = pathWhere(actor, "epi.read", "unitPath");
  if (!scope) return [];
  return prisma.epiDelivery.findMany({
    where: { AND: [scope, q.personId ? { personId: q.personId } : {}, q.workId ? { workId: q.workId } : {}] },
    include: { catalog: { select: { name: true, caNumber: true } }, person: { select: { id: true, name: true } }, work: { select: { id: true, code: true } } },
    orderBy: { deliveredAt: "desc" },
    take: 300,
  });
}
