import { prisma } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCan, can, canOnWork, pathWhere, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import type { z } from "zod";
import type { companySchema, contractSchema, updateCompanySchema } from "../validation/phase3";

const auditActor = (a: Actor) => ({ userId: a.userId, email: a.email });

export function formatCnpj(c: string) {
  return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export async function listCompanies(actor: Actor, q: { q?: string; status?: "ATIVO" | "INATIVO" } = {}) {
  const scope = pathWhere(actor, "company.read", "unitPath");
  if (!scope) return [];
  const digits = q.q?.replace(/\D/g, "");
  return prisma.company.findMany({
    where: {
      AND: [
        scope,
        q.status ? { status: q.status } : {},
        q.q ? { OR: [{ legalName: { contains: q.q, mode: "insensitive" } }, { tradeName: { contains: q.q, mode: "insensitive" } }, ...(digits ? [{ cnpj: { contains: digits } }] : [])] } : {},
      ],
    },
    include: { unit: { select: { name: true } }, _count: { select: { contracts: true, people: true } } },
    orderBy: { legalName: "asc" },
    take: 500,
  });
}

async function loadCompany(actor: Actor, id: string) {
  const c = await prisma.company.findUnique({ where: { id } });
  if (!c || !can(actor, "company.read", c.unitPath)) throw Errors.notFound("Empresa");
  return c;
}

export async function getCompany(actor: Actor, id: string) {
  await loadCompany(actor, id);
  const c = await prisma.company.findUniqueOrThrow({
    where: { id },
    include: {
      unit: { select: { id: true, name: true } },
      contracts: { orderBy: { createdAt: "desc" }, include: { work: { select: { id: true, code: true, title: true, unitPath: true } }, parent: { select: { number: true } } } },
      people: { where: { status: "ATIVO" }, select: { id: true, name: true, jobFunction: true, unitPath: true } },
    },
  });
  return {
    ...c,
    canManage: can(actor, "company.manage", c.unitPath),
    canContract: can(actor, "contract.manage", c.unitPath),
    people: c.people.filter((p) => can(actor, "person.read", p.unitPath)),
  };
}

export async function createCompany(actor: Actor, input: z.infer<typeof companySchema>, meta: RequestMeta) {
  const unit = await prisma.organizationUnit.findUnique({ where: { id: input.unitId } });
  if (!unit || !can(actor, "company.read", unit.path)) throw Errors.notFound("Unidade");
  assertCan(actor, "company.manage", unit.path, "Você não pode cadastrar empresas nesta unidade.");
  if (await prisma.company.findUnique({ where: { cnpj: input.cnpj }, select: { id: true } })) throw Errors.conflict("Já existe uma empresa com este CNPJ.");
  return prisma.$transaction(async (tx) => {
    const c = await tx.company.create({ data: { ...input, unitPath: unit.path, createdById: actor.userId } });
    await recordAudit({ action: "empresa.criada", actor: auditActor(actor), objectType: "Company", objectId: c.id, unitPath: c.unitPath, metadata: { cnpj: c.cnpj, razaoSocial: c.legalName } }, meta, tx);
    return c;
  });
}

export async function updateCompany(actor: Actor, id: string, input: z.infer<typeof updateCompanySchema>, meta: RequestMeta) {
  const c = await loadCompany(actor, id);
  assertCan(actor, "company.manage", c.unitPath, "Você não pode alterar esta empresa.");
  return prisma.$transaction(async (tx) => {
    const u = await tx.company.update({ where: { id }, data: input });
    await recordAudit({ action: "empresa.alterada", actor: auditActor(actor), objectType: "Company", objectId: id, unitPath: c.unitPath, metadata: { campos: Object.keys(input) } }, meta, tx);
    return u;
  });
}

/** Registra conferência cadastral feita por uma pessoa em fonte consultada. O sistema não valida sozinho. */
export async function verifyCompany(actor: Actor, id: string, source: string, meta: RequestMeta) {
  const c = await loadCompany(actor, id);
  assertCan(actor, "company.manage", c.unitPath);
  return prisma.$transaction(async (tx) => {
    const u = await tx.company.update({ where: { id }, data: { verification: "VERIFICADA_MANUALMENTE", verificationSource: source, verifiedAt: new Date(), verifiedById: actor.userId } });
    await recordAudit({ action: "empresa.conferida", actor: auditActor(actor), objectType: "Company", objectId: id, unitPath: c.unitPath, metadata: { fonte: source } }, meta, tx);
    return u;
  });
}

export async function createContract(actor: Actor, companyId: string, input: z.infer<typeof contractSchema>, meta: RequestMeta) {
  const c = await loadCompany(actor, companyId);
  assertCan(actor, "contract.manage", c.unitPath, "Você não pode cadastrar contratos para esta empresa.");
  let unitPath = c.unitPath;
  if (input.workId) {
    const w = await prisma.work.findUnique({ where: { id: input.workId } });
    if (!w || !canOnWork(actor, "work.read", w)) throw Errors.invalid("Obra inválida.", { workId: ["Obra não encontrada."] });
    unitPath = w.unitPath;
  }
  if (input.kind === "ADITIVO" && !input.parentId) throw Errors.invalid("Aditivo precisa do contrato original.", { parentId: ["Selecione o contrato original."] });
  if (input.parentId) {
    const parent = await prisma.contract.findFirst({ where: { id: input.parentId, companyId, kind: { not: "ADITIVO" } } });
    if (!parent) throw Errors.invalid("Contrato original inválido.", { parentId: ["Selecione um contrato desta empresa."] });
  }
  if (input.startDate && input.endDate && input.endDate < input.startDate) throw Errors.invalid("O término deve ser posterior ao início.", { endDate: ["Data inválida."] });
  return prisma.$transaction(async (tx) => {
    const k = await tx.contract.create({ data: { ...input, companyId, unitPath, createdById: actor.userId } });
    await recordAudit(
      { action: "contrato.criado", actor: auditActor(actor), objectType: "Contract", objectId: k.id, unitPath, metadata: { empresa: c.cnpj, numero: k.number, tipo: k.kind, valor: k.value?.toString() } },
      meta,
      tx,
    );
    return k;
  });
}

export async function setContractStatus(actor: Actor, companyId: string, contractId: string, status: "RASCUNHO" | "VIGENTE" | "ENCERRADO" | "CANCELADO", meta: RequestMeta) {
  const c = await loadCompany(actor, companyId);
  assertCan(actor, "contract.manage", c.unitPath);
  const k = await prisma.contract.findFirst({ where: { id: contractId, companyId } });
  if (!k) throw Errors.notFound("Contrato");
  return prisma.$transaction(async (tx) => {
    const u = await tx.contract.update({ where: { id: contractId }, data: { status } });
    await recordAudit({ action: "contrato.situacao", actor: auditActor(actor), objectType: "Contract", objectId: k.id, unitPath: k.unitPath, metadata: { de: k.status, para: status } }, meta, tx);
    return u;
  });
}
