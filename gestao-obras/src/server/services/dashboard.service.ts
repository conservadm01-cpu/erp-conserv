import { prisma } from "../db";
import { canAnywhere, grantsFor, pathWhere, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";

type Grouped = { _count: { _all: number } };
const countOf = <T extends Grouped>(rows: T[], pred: (r: T) => boolean) => rows.find(pred)?._count._all ?? 0;

/** Indicadores da Fase 1, todos calculados a partir do banco e restritos ao escopo do ator. */
export async function getDashboard(actor: Actor) {
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

  return {
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
