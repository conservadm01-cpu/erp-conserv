import { prisma } from "../db";
import type { Prisma } from "@prisma/client";
import { canAnywhere, grantsFor, pathWhere, workScopedWhere, type Actor } from "../authz/authorize";
import { markExpiredDocuments } from "./document.service";
import { startOfToday } from "./requirement.service";

export type DashboardFilter = { unitId?: string; typeCode?: string; status?: Prisma.WorkWhereInput["status"]; from?: Date; to?: Date };
import { Errors } from "../http/errors";

type Grouped = { _count: { _all: number } };
const countOf = <T extends Grouped>(rows: T[], pred: (r: T) => boolean) => rows.find(pred)?._count._all ?? 0;

/** Indicadores da Fase 1, todos calculados a partir do banco e restritos ao escopo do ator. */
export async function getDashboard(actor: Actor, filter: DashboardFilter = {}) {
  if (!canAnywhere(actor, "dashboard.view")) throw Errors.forbidden();
  const orgWhere = pathWhere(actor, "org.read");
  const userWhere = pathWhere(actor, "user.read");
  const auditGrants = grantsFor(actor, "audit.read");

  const [unitsByType, types, usersByStatus, usersWithoutMfa, recentDenied] = await Promise.all([
    orgWhere
      ? prisma.organizationUnit.groupBy({ by: ["typeCode", "status"], where: orgWhere, _count: { _all: true } })
      : Promise.resolve([]),
    prisma.orgUnitType.findMany({ orderBy: { sortOrder: "asc" } }),
    userWhere
      ? prisma.user.groupBy({ by: ["status"], where: { homeUnit: userWhere }, _count: { _all: true } })
      : Promise.resolve([]),
    userWhere
      ? prisma.user.count({ where: { homeUnit: userWhere, status: "ATIVO", mfaEnabledAt: null } })
      : Promise.resolve(null),
    auditGrants.length
      ? prisma.auditEvent.count({
          where: {
            result: { in: ["FALHA", "NEGADO"] },
            occurredAt: { gte: new Date(Date.now() - 24 * 3_600_000) },
            OR: auditGrants.map((g) => (g.includeDescendants ? { unitPath: { startsWith: g.path } } : { unitPath: g.path })),
          },
        })
      : Promise.resolve(null),
  ]);

  const works = await workIndicators(actor, filter);
  return {
    works,
    units: types.map((t) => ({
      typeCode: t.code,
      typeName: t.name,
      ativas: countOf(unitsByType, (u) => u.typeCode === t.code && u.status === "ATIVA"),
      inativas: countOf(unitsByType, (u) => u.typeCode === t.code && u.status === "INATIVA"),
    })),
    users: userWhere
      ? {
          ativos: countOf(usersByStatus, (u) => u.status === "ATIVO"),
          bloqueados: countOf(usersByStatus, (u) => u.status === "BLOQUEADO"),
          inativos: countOf(usersByStatus, (u) => u.status === "INATIVO"),
          semMfa: usersWithoutMfa ?? 0,
        }
      : null,
    deniedLast24h: recentDenied,
  };
}

/** Indicadores de obras, documentos e aprovações, restritos ao escopo e aos filtros. */
async function workIndicators(actor: Actor, f: DashboardFilter) {
  const scope = workScopedWhere(actor, "work.read", "id");
  if (!scope) return null;
  let unitFilter: Prisma.WorkWhereInput = {};
  if (f.unitId) {
    const unit = await prisma.organizationUnit.findUnique({ where: { id: f.unitId }, select: { path: true } });
    unitFilter = { unitPath: { startsWith: unit?.path ?? "/inexistente/" } };
  }
  const workWhere: Prisma.WorkWhereInput = {
    AND: [
      scope,
      unitFilter,
      f.typeCode ? { typeCode: f.typeCode } : {},
      f.status ? { status: f.status } : {},
      f.from || f.to ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } } : {},
    ],
  };
  await markExpiredDocuments(prisma);
  const today = startOfToday();
  const in30 = new Date(today.getTime() + 30 * 86_400_000);
  const docScope = workScopedWhere(actor, "document.read", "workId");
  const docWhere: Prisma.DocumentWhereInput = { AND: [docScope ?? { id: "00000000-0000-0000-0000-000000000000" }, { work: workWhere }] };
  const approvalScope = workScopedWhere(actor, "approval.decide", "workId");
  const [byStatus, pending, expired, expiring, approvals, lateStages] = await Promise.all([
    prisma.work.groupBy({ by: ["status"], where: workWhere, _count: { _all: true } }),
    prisma.document.count({ where: { AND: [docWhere, { status: { in: ["ENVIADO", "EM_REVISAO"] } }] } }),
    prisma.document.count({ where: { AND: [docWhere, { status: "VENCIDO" }] } }),
    prisma.document.count({ where: { AND: [docWhere, { status: "APROVADO", expiryDate: { gte: today, lte: in30 } }] } }),
    approvalScope ? prisma.approval.count({ where: { AND: [approvalScope, { status: "PENDENTE" }, { work: workWhere }] } }) : Promise.resolve(null),
    prisma.workStage.count({ where: { work: workWhere, status: { in: ["NAO_INICIADA", "EM_ANDAMENTO"] }, plannedEnd: { lt: today } } }),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  return {
    total: byStatus.reduce((n, b) => n + b._count._all, 0),
    byStatus: Object.fromEntries(byStatus.map((b) => [b.status, b._count._all])),
    planejamento: count("RASCUNHO") + count("SOLICITADA") + count("EM_TRIAGEM") + count("EM_APROVACAO") + count("APROVADA"),
    execucao: count("EM_EXECUCAO") + count("EM_VISTORIA"),
    suspensas: count("SUSPENSA"),
    concluidas: count("CONCLUIDA"),
    documentos: { pendentes: pending, vencidos: expired, aVencer30: expiring },
    aprovacoesPendentes: approvals,
    etapasAtrasadas: lateStages,
  };
}
