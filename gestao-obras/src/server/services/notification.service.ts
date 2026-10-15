import type { NotificationSeverity } from "@prisma/client";
import { prisma, type Db } from "../db";
import { env } from "../env";
import { scopeCovers, type Actor } from "../authz/authorize";
import type { PermissionCode } from "../authz/catalog";
import { Errors } from "../http/errors";
import { getMailer } from "../mail/mailer";
import { startOfToday } from "./requirement.service";

export type NewNotification = { kind: string; severity: NotificationSeverity; title: string; body: string; link?: string; dedupKey: string };

/** Usuários ativos com a permissão na unidade (ou na obra, por escopo de obra). */
export async function recipientsFor(permission: PermissionCode, unitPath: string, workId?: string, db: Db = prisma) {
  const scopes = await db.userScope.findMany({
    where: { user: { status: "ATIVO" }, unit: { status: "ATIVA" }, role: { permissions: { some: { permissionCode: permission } } } },
    select: { userId: true, workId: true, includeDescendants: true, unit: { select: { path: true } } },
  });
  return [...new Set(scopes.filter((s) => (s.workId ? s.workId === workId : scopeCovers({ unitPath: s.unit.path, includeDescendants: s.includeDescendants, workId: null }, unitPath))).map((s) => s.userId))];
}

/** Cria notificações sem duplicar (mesmo usuário + mesma chave) e envia e-mail para alertas. */
export async function notify(userIds: string[], n: NewNotification, db: Db = prisma) {
  if (!userIds.length) return 0;
  const existing = await db.notification.findMany({ where: { dedupKey: n.dedupKey, userId: { in: userIds } }, select: { userId: true } });
  const fresh = userIds.filter((u) => !existing.some((e) => e.userId === u));
  if (!fresh.length) return 0;
  await db.notification.createMany({ data: fresh.map((userId) => ({ userId, ...n })), skipDuplicates: true });
  if (n.severity !== "INFO") {
    const users = await db.user.findMany({ where: { id: { in: fresh } }, select: { id: true, email: true, name: true } });
    for (const u of users) {
      try {
        await getMailer().send({
          to: u.email,
          subject: `${n.severity === "CRITICO" ? "[CRÍTICO] " : "[Alerta] "}${n.title}`,
          text: `Olá, ${u.name}.\n\n${n.body}\n\n${n.link ? `Acesse: ${env().APP_URL}${n.link}\n\n` : ""}Mensagem automática do sistema de Gestão de Obras.`,
        });
        await db.notification.updateMany({ where: { userId: u.id, dedupKey: n.dedupKey }, data: { emailedAt: new Date() } });
      } catch (e) {
        // Falha de e-mail não impede o registro da notificação interna.
        console.error("[notificacao] falha ao enviar e-mail", e instanceof Error ? e.message : e);
      }
    }
  }
  return fresh.length;
}

export async function listMyNotifications(actor: Actor, opts: { unreadOnly?: boolean } = {}) {
  return prisma.notification.findMany({
    where: { userId: actor.userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
    orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(actor: Actor, ids: string[] | "all") {
  const res = await prisma.notification.updateMany({
    where: { userId: actor.userId, readAt: null, ...(ids === "all" ? {} : { id: { in: ids } }) },
    data: { readAt: new Date() },
  });
  if (ids !== "all" && ids.length && res.count === 0) {
    const own = await prisma.notification.count({ where: { userId: actor.userId, id: { in: ids } } });
    if (!own) throw Errors.notFound("Notificação");
  }
  return res.count;
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "UTC" });

/**
 * Gera os alertas periódicos. Cada fato gera uma única notificação por
 * destinatário (chave de deduplicação), exceto quando muda de estado.
 */
export async function generateAlerts(now = new Date()) {
  const today = startOfToday();
  const in30 = new Date(today.getTime() + 30 * 86_400_000);
  let created = 0;

  // Documentos vencidos e próximos do vencimento.
  const docs = await prisma.document.findMany({
    where: { OR: [{ status: "VENCIDO" }, { status: "APROVADO", expiryDate: { gte: today, lte: in30 } }] },
    include: { work: { select: { id: true, code: true } } },
  });
  for (const d of docs) {
    const expired = d.status === "VENCIDO";
    const users = await recipientsFor("document.upload", d.unitPath, d.workId ?? undefined);
    created += await notify(users, {
      kind: expired ? "documento.vencido" : "documento.vencendo",
      severity: expired ? "ALERTA" : "INFO",
      title: expired ? `Documento vencido: ${d.title}` : `Documento vence em breve: ${d.title}`,
      body: `${d.work ? `Obra ${d.work.code}. ` : ""}Validade: ${d.expiryDate ? fmt(d.expiryDate) : "—"}.`,
      link: d.work ? `/obras/${d.work.id}?aba=documentos` : "/documentos",
      dedupKey: `${expired ? "doc-vencido" : "doc-vencendo"}:${d.id}:${d.expiryDate ? day(d.expiryDate) : ""}`,
    });
  }

  // Qualificações e treinamentos vencidos ou a vencer.
  const creds = await prisma.professionalCredential.findMany({
    where: { status: "ATIVO", expiryDate: { lte: in30 }, person: { status: "ATIVO" } },
    include: { person: { select: { id: true, name: true, unitPath: true } } },
  });
  for (const c of creds) {
    const expired = c.expiryDate! < today;
    created += await notify(await recipientsFor("person.manage", c.person.unitPath), {
      kind: expired ? "qualificacao.vencida" : "qualificacao.vencendo",
      severity: expired ? "ALERTA" : "INFO",
      title: `${expired ? "Vencido" : "Vence em breve"}: ${c.name} — ${c.person.name}`,
      body: `Validade: ${fmt(c.expiryDate!)}.`,
      link: `/pessoas/${c.person.id}`,
      dedupKey: `${expired ? "cred-vencida" : "cred-vencendo"}:${c.id}:${day(c.expiryDate!)}`,
    });
  }

  // Integração/orientação de segurança pendente para quem atua em obra em execução.
  const noBriefing = await prisma.volunteerAssignment.findMany({
    where: { status: "ATIVO", safetyBriefingAt: null, work: { status: "EM_EXECUCAO" } },
    include: { person: { select: { id: true, name: true } }, work: { select: { id: true, code: true, unitPath: true } } },
  });
  for (const a of noBriefing) {
    created += await notify(await recipientsFor("work.manage", a.work.unitPath, a.work.id), {
      kind: "treinamento.pendente", severity: "ALERTA",
      title: `Integração de segurança pendente: ${a.person.name}`, body: `Obra ${a.work.code}, função ${a.role}. Registre a orientação de segurança antes da atuação.`,
      link: `/pessoas/${a.person.id}`, dedupKey: `integracao:${a.id}`,
    });
  }

  // Inspeções planejadas e não realizadas.
  const lateInspections = await prisma.inspection.findMany({
    where: { status: { in: ["PLANEJADA", "EM_ANDAMENTO"] }, plannedDate: { lt: today } },
    include: { work: { select: { id: true, code: true } } },
  });
  for (const i of lateInspections) {
    created += await notify(await recipientsFor("safety.inspect", i.unitPath, i.workId), {
      kind: "inspecao.atrasada", severity: "ALERTA",
      title: `Inspeção atrasada: ${i.title}`, body: `Obra ${i.work.code}. Prevista para ${fmt(i.plannedDate)}.`,
      link: `/seguranca/inspecoes/${i.id}`, dedupKey: `inspecao-atrasada:${i.id}`,
    });
  }

  // Ações corretivas vencidas.
  const lateActions = await prisma.correctiveAction.findMany({
    where: { status: { in: ["ABERTA", "EM_ANDAMENTO"] }, dueDate: { lt: today } },
    include: { work: { select: { id: true, code: true } } },
  });
  for (const a of lateActions) {
    const users = new Set([...(await recipientsFor("safety.action", a.unitPath, a.workId)), ...(a.responsibleUserId ? [a.responsibleUserId] : [])]);
    created += await notify([...users], {
      kind: "acao.vencida", severity: a.criticality === "CRITICA" ? "CRITICO" : "ALERTA",
      title: `Ação corretiva vencida: ${a.title}`, body: `Obra ${a.work.code}. Prazo: ${fmt(a.dueDate)}. Responsável: ${a.responsibleName}.`,
      link: `/seguranca/acoes/${a.id}`, dedupKey: `acao-vencida:${a.id}:${day(a.dueDate)}`,
    });
  }

  // Etapas atrasadas.
  const lateStages = await prisma.workStage.findMany({
    where: { status: { in: ["NAO_INICIADA", "EM_ANDAMENTO"] }, plannedEnd: { lt: today }, work: { status: { in: ["APROVADA", "EM_EXECUCAO"] } } },
    include: { work: { select: { id: true, code: true, unitPath: true } } },
  });
  for (const s of lateStages) {
    created += await notify(await recipientsFor("work.manage", s.work.unitPath, s.work.id), {
      kind: "etapa.atrasada", severity: "ALERTA",
      title: `Etapa atrasada: ${s.name}`, body: `Obra ${s.work.code}. Término previsto: ${fmt(s.plannedEnd!)}.`,
      link: `/obras/${s.work.id}?aba=etapas`, dedupKey: `etapa-atrasada:${s.id}:${day(s.plannedEnd!)}`,
    });
  }

  // Obras paradas: suspensas há mais de 30 dias ou em execução sem atualização há 30 dias.
  const stale = new Date(now.getTime() - 30 * 86_400_000);
  const stalled = await prisma.work.findMany({
    where: { OR: [{ status: "SUSPENSA", updatedAt: { lt: stale } }, { status: "EM_EXECUCAO", updatedAt: { lt: stale }, stages: { none: { updatedAt: { gte: stale } } } }] },
  });
  for (const w of stalled) {
    created += await notify(await recipientsFor("work.transition", w.unitPath, w.id), {
      kind: "obra.parada", severity: "ALERTA",
      title: `Obra sem andamento: ${w.code}`, body: `${w.title} está ${w.status === "SUSPENSA" ? "suspensa" : "sem atualização"} há mais de 30 dias.`,
      link: `/obras/${w.id}`, dedupKey: `obra-parada:${w.id}:${day(w.updatedAt)}`,
    });
  }

  // Aprovações pendentes há mais de 3 dias.
  const oldApprovals = await prisma.approval.findMany({ where: { status: "PENDENTE", createdAt: { lt: new Date(now.getTime() - 3 * 86_400_000) } }, include: { work: { select: { code: true } } } });
  for (const a of oldApprovals) {
    created += await notify(await recipientsFor("approval.decide", a.unitPath, a.workId), {
      kind: "aprovacao.pendente", severity: "INFO",
      title: `Aprovação aguardando decisão: ${a.work.code}`, body: "A solicitação aguarda decisão há mais de 3 dias.",
      link: `/aprovacoes/${a.id}`, dedupKey: `aprovacao-pendente:${a.id}`,
    });
  }

  // Estoque de EPI abaixo do mínimo e CA vencido.
  const { lowStock } = await import("./epi.service");
  for (const l of await lowStock()) {
    created += await notify(await recipientsFor("epi.stock", l.unitPath), {
      kind: "epi.estoque_baixo", severity: "ALERTA",
      title: `Estoque baixo: ${l.name}`, body: `${l.unitName}: ${l.balance} unidade(s); mínimo ${l.minStock}.`,
      link: "/epis", dedupKey: `epi-estoque:${l.catalogId}:${l.unitId}:${day(today)}`,
    });
  }
  const expiredCa = await prisma.epiCatalog.findMany({ where: { status: "ATIVO", caExpiry: { lt: today } } });
  if (expiredCa.length) {
    const root = await prisma.organizationUnit.findFirst({ where: { depth: 0 } });
    if (root) {
      for (const e of expiredCa) {
        created += await notify(await recipientsFor("epi.manage", root.path), {
          kind: "epi.ca_vencido", severity: "ALERTA", title: `CA vencido: ${e.name}`,
          body: `O Certificado de Aprovação ${e.caNumber ?? ""} venceu em ${fmt(e.caExpiry!)}. Verifique a situação na fonte oficial.`,
          link: "/epis", dedupKey: `epi-ca:${e.id}:${day(e.caExpiry!)}`,
        });
      }
    }
  }

  // Equipamentos com inspeção ou manutenção vencida.
  const dueEquipment = await prisma.equipment.findMany({
    where: { status: { not: "BAIXADO" }, OR: [{ nextInspectionAt: { lt: today } }, { nextMaintenanceAt: { lt: today } }] },
  });
  for (const e of dueEquipment) {
    created += await notify(await recipientsFor("equipment.manage", e.unitPath), {
      kind: "equipamento.vencido", severity: "ALERTA", title: `Inspeção/manutenção vencida: ${e.name}`,
      body: `Próxima inspeção: ${e.nextInspectionAt ? fmt(e.nextInspectionAt) : "—"}; próxima manutenção: ${e.nextMaintenanceAt ? fmt(e.nextMaintenanceAt) : "—"}.`,
      link: `/equipamentos/${e.id}`, dedupKey: `equip:${e.id}:${e.nextInspectionAt ? day(e.nextInspectionAt) : ""}:${e.nextMaintenanceAt ? day(e.nextMaintenanceAt) : ""}`,
    });
  }

  return created;
}
