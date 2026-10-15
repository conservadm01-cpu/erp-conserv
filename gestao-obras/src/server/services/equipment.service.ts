import type { EquipmentStatus } from "@prisma/client";
import { prisma } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCan, can, pathWhere, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import type { z } from "zod";
import type { equipmentLogSchema, equipmentSchema } from "../validation/phase3";

const auditActor = (a: Actor) => ({ userId: a.userId, email: a.email });
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

export async function listEquipment(actor: Actor, q: { q?: string; status?: EquipmentStatus } = {}) {
  const scope = pathWhere(actor, "equipment.read", "unitPath");
  if (!scope) return [];
  return prisma.equipment.findMany({
    where: { AND: [scope, q.status ? { status: q.status } : { status: { not: "BAIXADO" } }, q.q ? { OR: [{ name: { contains: q.q, mode: "insensitive" } }, { identifier: { contains: q.q, mode: "insensitive" } }] } : {}] },
    include: { unit: { select: { name: true } } },
    orderBy: { name: "asc" },
    take: 500,
  });
}

async function loadEquipment(actor: Actor, id: string) {
  const e = await prisma.equipment.findUnique({ where: { id } });
  if (!e || !can(actor, "equipment.read", e.unitPath)) throw Errors.notFound("Equipamento");
  return e;
}

export async function getEquipment(actor: Actor, id: string) {
  await loadEquipment(actor, id);
  const e = await prisma.equipment.findUniqueOrThrow({ where: { id }, include: { unit: { select: { id: true, name: true } }, logs: { orderBy: { date: "desc" }, take: 200 } } });
  const actors = await prisma.user.findMany({ where: { id: { in: e.logs.map((l) => l.actorId) } }, select: { id: true, name: true } });
  return { ...e, canManage: can(actor, "equipment.manage", e.unitPath), people: Object.fromEntries(actors.map((a) => [a.id, a.name])) };
}

export async function createEquipment(actor: Actor, input: z.infer<typeof equipmentSchema>, meta: RequestMeta) {
  const unit = await prisma.organizationUnit.findUnique({ where: { id: input.unitId } });
  if (!unit || !can(actor, "equipment.read", unit.path)) throw Errors.notFound("Unidade");
  assertCan(actor, "equipment.manage", unit.path, "Você não pode cadastrar equipamentos nesta unidade.");
  return prisma.$transaction(async (tx) => {
    const e = await tx.equipment.create({ data: { ...input, nextInspectionAt: input.nextInspectionAt ?? null, nextMaintenanceAt: input.nextMaintenanceAt ?? null, unitPath: unit.path } });
    await recordAudit({ action: "equipamento.criado", actor: auditActor(actor), objectType: "Equipment", objectId: e.id, unitPath: e.unitPath, metadata: { nome: e.name, tipo: e.kind } }, meta, tx);
    return e;
  });
}

/** Registra inspeção, manutenção ou defeito e atualiza próximas datas e situação. */
export async function addEquipmentLog(actor: Actor, id: string, input: z.infer<typeof equipmentLogSchema>, meta: RequestMeta) {
  const e = await loadEquipment(actor, id);
  assertCan(actor, "equipment.manage", e.unitPath);
  if (e.status === "BAIXADO") throw Errors.conflict("Equipamento baixado não recebe registros.");
  let status: EquipmentStatus = e.status;
  const data: Record<string, unknown> = {};
  if (input.type === "INSPECAO") {
    if (input.approved === undefined || input.approved === null) throw Errors.invalid("Informe o resultado da inspeção.", { approved: ["Resultado obrigatório."] });
    if (e.inspectionIntervalDays) data.nextInspectionAt = addDays(input.date, e.inspectionIntervalDays);
    if (!input.approved) status = "INTERDITADO";
  } else if (input.type === "MANUTENCAO") {
    if (e.maintenanceIntervalDays) data.nextMaintenanceAt = addDays(input.date, e.maintenanceIntervalDays);
    if (["EM_MANUTENCAO", "INTERDITADO"].includes(e.status) && input.approved) status = "DISPONIVEL";
  } else if (input.interdict) {
    status = "INTERDITADO";
  }
  return prisma.$transaction(async (tx) => {
    const log = await tx.equipmentLog.create({ data: { equipmentId: id, type: input.type, date: input.date, approved: input.approved ?? null, notes: input.notes, actorId: actor.userId } });
    await tx.equipment.update({ where: { id }, data: { ...data, status } });
    await recordAudit({ action: `equipamento.${input.type.toLowerCase()}`, actor: auditActor(actor), objectType: "Equipment", objectId: id, unitPath: e.unitPath, metadata: { aprovado: input.approved ?? undefined, situacao: status } }, meta, tx);
    return log;
  });
}

export async function setEquipmentStatus(actor: Actor, id: string, status: EquipmentStatus, reason: string, meta: RequestMeta) {
  const e = await loadEquipment(actor, id);
  assertCan(actor, "equipment.manage", e.unitPath);
  if (e.status === "BAIXADO") throw Errors.conflict("Equipamento baixado não pode ser reativado.");
  return prisma.$transaction(async (tx) => {
    const u = await tx.equipment.update({ where: { id }, data: { status } });
    await recordAudit({ action: "equipamento.situacao", actor: auditActor(actor), objectType: "Equipment", objectId: id, unitPath: e.unitPath, metadata: { de: e.status, para: status, justificativa: reason } }, meta, tx);
    return u;
  });
}
