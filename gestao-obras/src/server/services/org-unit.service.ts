import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCan, can, pathWhere, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import type { CreateOrgUnitInput, UpdateOrgUnitInput } from "../validation/org-unit";

const auditActor = (a: Actor) => ({ userId: a.userId, email: a.email });

export async function listOrgUnitTypes() {
  return prisma.orgUnitType.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function getRootUnit() {
  return prisma.organizationUnit.findFirst({ where: { depth: 0 }, orderBy: { createdAt: "asc" } });
}

/** Unidades visíveis ao ator (permissão org.read), em ordem de árvore. */
export async function listOrgUnits(actor: Actor, filter: { status?: "ATIVA" | "INATIVA"; q?: string } = {}) {
  const where = pathWhere(actor, "org.read");
  if (!where) return [];
  const units = await prisma.organizationUnit.findMany({
    where: {
      AND: [where],
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.q ? { OR: [{ name: { contains: filter.q, mode: "insensitive" } }, { code: { contains: filter.q, mode: "insensitive" } }] } : {}),
    },
    include: { type: { select: { name: true } }, _count: { select: { children: true, users: true } } },
    orderBy: [{ path: "asc" }],
  });
  return units.map((u) => ({
    ...u,
    canManage: can(actor, "org.manage", u.path),
  }));
}

async function loadVisible(actor: Actor, id: string) {
  const unit = await prisma.organizationUnit.findUnique({
    where: { id },
    include: {
      type: true,
      parent: { select: { id: true, name: true, code: true } },
      contacts: { orderBy: { createdAt: "asc" } },
      _count: { select: { children: true, users: true } },
    },
  });
  // Fora do escopo responde como inexistente para não revelar dados de outras regiões.
  if (!unit || !can(actor, "org.read", unit.path)) throw Errors.notFound("Unidade");
  return unit;
}

export async function getOrgUnit(actor: Actor, id: string) {
  const unit = await loadVisible(actor, id);
  return { ...unit, canManage: can(actor, "org.manage", unit.path) };
}

async function assertParentAllowed(typeCode: string, parentTypeCode: string) {
  const type = await prisma.orgUnitType.findUnique({ where: { code: typeCode } });
  if (!type) throw Errors.invalid("Tipo de unidade inexistente.", { typeCode: ["Tipo inválido."] });
  if (type.isRoot) throw Errors.invalid("A unidade raiz já existe e não pode ser duplicada.", { typeCode: ["Tipo não permitido."] });
  if (!type.allowedParentCodes.includes(parentTypeCode)) {
    throw Errors.invalid(`Uma unidade do tipo "${type.name}" não pode ficar subordinada a este tipo de unidade.`, {
      parentId: ["Unidade superior incompatível com o tipo."],
    });
  }
}

export async function createOrgUnit(actor: Actor, input: CreateOrgUnitInput, meta: RequestMeta) {
  const parent = await prisma.organizationUnit.findUnique({ where: { id: input.parentId } });
  if (!parent || !can(actor, "org.read", parent.path)) throw Errors.notFound("Unidade superior");
  assertCan(actor, "org.manage", parent.path, "Você não pode criar unidades abaixo desta unidade.");
  if (parent.status !== "ATIVA") throw Errors.invalid("A unidade superior está inativa.");
  await assertParentAllowed(input.typeCode, parent.typeCode);

  const id = randomUUID();
  const { contacts, parentId, ...fields } = input;
  return prisma.$transaction(async (tx) => {
    const unit = await tx.organizationUnit.create({
      data: {
        id,
        ...fields,
        parentId,
        path: `${parent.path}${id}/`,
        depth: parent.depth + 1,
        createdById: actor.userId,
        updatedById: actor.userId,
        contacts: { create: contacts },
      },
    });
    await recordAudit(
      {
        action: "org.unidade.criada",
        actor: auditActor(actor),
        objectType: "OrganizationUnit",
        objectId: unit.id,
        unitPath: unit.path,
        metadata: { codigo: unit.code, nome: unit.name, tipo: unit.typeCode, superior: parent.code },
      },
      meta,
      tx,
    );
    return unit;
  });
}

export async function updateOrgUnit(actor: Actor, id: string, input: UpdateOrgUnitInput, meta: RequestMeta) {
  const unit = await loadVisible(actor, id);
  assertCan(actor, "org.manage", unit.path, "Você não pode alterar esta unidade.");
  const { contacts, parentId, ...fields } = input;

  let move: { oldPath: string; newPath: string; depthDelta: number; parentId: string } | null = null;
  if (parentId && parentId !== unit.parentId) {
    if (unit.depth === 0) throw Errors.invalid("A unidade raiz não pode ser movida.");
    const newParent = await prisma.organizationUnit.findUnique({ where: { id: parentId } });
    if (!newParent || !can(actor, "org.read", newParent.path)) throw Errors.notFound("Unidade superior");
    assertCan(actor, "org.manage", newParent.path, "Você não pode mover unidades para esta unidade superior.");
    if (unit.parent) {
      const oldParent = await prisma.organizationUnit.findUniqueOrThrow({ where: { id: unit.parent.id } });
      assertCan(actor, "org.manage", oldParent.path, "Você não pode retirar a unidade da unidade superior atual.");
    }
    if (newParent.path.startsWith(unit.path)) throw Errors.invalid("Uma unidade não pode ficar subordinada a si mesma ou a uma descendente.");
    await assertParentAllowed(unit.typeCode, newParent.typeCode);
    move = { oldPath: unit.path, newPath: `${newParent.path}${unit.id}/`, depthDelta: newParent.depth + 1 - unit.depth, parentId };
  }

  return prisma.$transaction(async (tx) => {
    if (move) {
      // Atualiza o caminho da unidade e de todas as descendentes em uma única instrução.
      await tx.$executeRaw`
        UPDATE organization_unit
           SET path = ${move.newPath}::text || substring(path from ${move.oldPath.length + 1}::int),
               depth = depth + ${move.depthDelta}::int,
               updated_at = now()
         WHERE path LIKE ${move.oldPath + "%"}::text`;
    }
    if (contacts) {
      await tx.orgUnitContact.deleteMany({ where: { unitId: id } });
      if (contacts.length) await tx.orgUnitContact.createMany({ data: contacts.map((c) => ({ ...c, unitId: id })) });
    }
    const updated = await tx.organizationUnit.update({
      where: { id },
      data: { ...fields, ...(move ? { parentId: move.parentId } : {}), updatedById: actor.userId },
    });
    await recordAudit(
      {
        action: move ? "org.unidade.movida" : "org.unidade.alterada",
        actor: auditActor(actor),
        objectType: "OrganizationUnit",
        objectId: id,
        unitPath: updated.path,
        metadata: {
          campos: Object.keys(fields).filter((k) => (fields as Record<string, unknown>)[k] !== undefined),
          contatosAlterados: Boolean(contacts),
          ...(move ? { caminhoAnterior: move.oldPath } : {}),
        },
      },
      meta,
      tx,
    );
    return updated;
  });
}

export async function setOrgUnitStatus(actor: Actor, id: string, status: "ATIVA" | "INATIVA", reason: string, meta: RequestMeta) {
  const unit = await loadVisible(actor, id);
  assertCan(actor, "org.manage", unit.path, "Você não pode alterar a situação desta unidade.");
  if (unit.depth === 0 && status === "INATIVA") throw Errors.invalid("A unidade raiz não pode ser inativada.");
  if (unit.status === status) return unit;
  if (status === "INATIVA") {
    const activeChildren = await prisma.organizationUnit.count({ where: { parentId: id, status: "ATIVA" } });
    if (activeChildren > 0) throw Errors.conflict("Inative primeiro as unidades subordinadas ativas.");
  } else if (unit.parent) {
    const parent = await prisma.organizationUnit.findUniqueOrThrow({ where: { id: unit.parent.id } });
    if (parent.status !== "ATIVA") throw Errors.conflict("Reative primeiro a unidade superior.");
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.organizationUnit.update({ where: { id }, data: { status, updatedById: actor.userId } });
    await recordAudit(
      {
        action: status === "INATIVA" ? "org.unidade.inativada" : "org.unidade.reativada",
        actor: auditActor(actor),
        objectType: "OrganizationUnit",
        objectId: id,
        unitPath: unit.path,
        metadata: { justificativa: reason },
      },
      meta,
      tx,
    );
    return updated;
  });
}
