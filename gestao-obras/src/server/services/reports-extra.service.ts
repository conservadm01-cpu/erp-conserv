import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCanOnWork, can, canAnywhere, canOnWork, grantsFor, workScopedWhere, type Actor } from "../authz/authorize";
import type { PermissionCode } from "../authz/catalog";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import { STATUS_LABEL } from "../domain/work-state";
import { fmtDate, fmtDateTime, Report } from "../reports/pdf";
import { getStorage } from "../storage/storage";
import { budgetSummary } from "./budget.service";
import { markExpiredDocuments } from "./document.service";
import { getRootUnit } from "./org-unit.service";
import { startOfToday } from "./requirement.service";

const brl = (v: number | { toString(): string }) => Number(v.toString()).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const DOC: Record<string, string> = { ENVIADO: "Enviado", EM_REVISAO: "Em revisão", APROVADO: "Aprovado", REJEITADO: "Rejeitado", VENCIDO: "Vencido", SUBSTITUIDO: "Substituído" };
const ACTION: Record<string, string> = { ABERTA: "Aberta", EM_ANDAMENTO: "Em andamento", AGUARDANDO_VALIDACAO: "Aguardando validação", ENCERRADA: "Encerrada", CANCELADA: "Cancelada" };
const RECEIPT: Record<string, string> = { TERMO_FISICO_ARQUIVADO: "Termo em papel arquivado", CONFIRMACAO_PRESENCIAL_REGISTRADA: "Confirmação presencial", PENDENTE: "Pendente" };
const CAT: Record<string, string> = { MATERIAIS: "Materiais", SERVICOS: "Serviços", MAO_DE_OBRA: "Mão de obra", LOCACOES: "Locações", OUTRAS: "Outras despesas" };

export const REPORTS = {
  "resumo-executivo": { title: "Resumo executivo da obra", scope: "obra", permission: "work.read" },
  "relacao-documentos": { title: "Relação de documentos", scope: "obra", permission: "document.read" },
  "documentos-pendentes": { title: "Documentos vencidos e pendentes", scope: "geral", permission: "document.read" },
  "plano-acoes": { title: "Plano de ações corretivas", scope: "obra", permission: "safety.read" },
  "entregas-epi": { title: "Registro de entrega de EPIs", scope: "obra", permission: "epi.read" },
  cronograma: { title: "Cronograma", scope: "obra", permission: "work.read" },
  "orcamento-medicoes": { title: "Orçamento e medições", scope: "obra", permission: "budget.read" },
  fotografico: { title: "Relatório fotográfico", scope: "obra", permission: "document.read" },
  "termo-vistoria": { title: "Termo de vistoria", scope: "obra", permission: "work.read" },
  encerramento: { title: "Relatório de encerramento", scope: "obra", permission: "work.read" },
  "consolidado-regiao": { title: "Visão consolidada por região", scope: "geral", permission: "dashboard.view" },
  auditoria: { title: "Histórico de auditoria", scope: "geral", permission: "audit.read" },
} as const satisfies Record<string, { title: string; scope: "obra" | "geral"; permission: PermissionCode }>;

export type ReportType = keyof typeof REPORTS;

async function workFor(actor: Actor, workId: string, permission: PermissionCode) {
  const work = await prisma.work.findUnique({ where: { id: workId }, include: { unit: true, type: true } });
  if (!work || !canOnWork(actor, "work.read", work)) throw Errors.notFound("Obra");
  assertCanOnWork(actor, permission, work, "Você não tem acesso a esta informação da obra.");
  assertCanOnWork(actor, "report.generate", work, "Você não pode gerar relatórios desta obra.");
  return work;
}

type W = Awaited<ReturnType<typeof workFor>>;
const header = (r: Report, w: W) =>
  r.fields([["Obra", `${w.code} — ${w.title}`], ["Situação", STATUS_LABEL[w.status]], ["Unidade", w.unit.name], ["Tipo", w.type.name]]);

async function people(ids: (string | null | undefined)[]) {
  const list = await prisma.user.findMany({ where: { id: { in: ids.filter(Boolean) as string[] } }, select: { id: true, name: true } });
  return new Map(list.map((p) => [p.id, p.name]));
}

async function workReport(actor: Actor, type: ReportType, w: W, r: Report) {
  const today = startOfToday();
  switch (type) {
    case "resumo-executivo": {
      const [stages, actions, docs, summary, approvals] = await Promise.all([
        prisma.workStage.findMany({ where: { workId: w.id } }),
        prisma.correctiveAction.findMany({ where: { workId: w.id } }),
        prisma.document.findMany({ where: { workId: w.id } }),
        canOnWork(actor, "budget.read", w) ? budgetSummary(prisma, w.id) : Promise.resolve(null),
        prisma.approval.findMany({ where: { workId: w.id, status: "PENDENTE" } }),
      ]);
      const progress = stages.length ? Math.round(stages.reduce((s, x) => s + x.progress, 0) / stages.length) : 0;
      r.heading("Identificação");
      header(r, w);
      r.heading("Situação geral");
      r.fields([
        ["Avanço médio das etapas", `${progress}% (${stages.length} etapa(s))`],
        ["Etapas atrasadas", String(stages.filter((s) => s.plannedEnd && s.plannedEnd < today && ["NAO_INICIADA", "EM_ANDAMENTO"].includes(s.status)).length)],
        ["Ações corretivas abertas", String(actions.filter((a) => ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO_VALIDACAO"].includes(a.status)).length)],
        ["Ações vencidas", String(actions.filter((a) => ["ABERTA", "EM_ANDAMENTO"].includes(a.status) && a.dueDate < today).length)],
        ["Documentos pendentes de análise", String(docs.filter((d) => ["ENVIADO", "EM_REVISAO"].includes(d.status)).length)],
        ["Documentos vencidos", String(docs.filter((d) => d.status === "VENCIDO").length)],
        ["Aprovações em andamento", String(approvals.length)],
        ["Previsão", `${fmtDate(w.plannedStart)} a ${fmtDate(w.plannedEnd)}`],
      ]);
      if (summary) {
        r.heading("Orçamento");
        r.fields([["Orçado", brl(summary.totals.orcado)], ["Contratado + comprometido", brl(summary.totals.contratado + summary.totals.comprometido)], ["Medido", brl(summary.totals.medido)], ["Pago (registrado)", brl(summary.totals.pago)]]);
      }
      r.heading("Escopo");
      r.paragraph(w.scope);
      return;
    }
    case "relacao-documentos": {
      await markExpiredDocuments(prisma, { workId: w.id });
      const docs = await prisma.document.findMany({ where: { workId: w.id }, include: { category: true, versions: { orderBy: { versionNo: "desc" } } }, orderBy: [{ categoryCode: "asc" }, { title: "asc" }] });
      r.heading("Identificação");
      header(r, w);
      r.heading(`Documentos (${docs.length})`);
      r.table(
        [{ header: "Documento", width: 26 }, { header: "Categoria", width: 15 }, { header: "Nº / emissor", width: 16 }, { header: "Validade", width: 10 }, { header: "Situação", width: 10 }, { header: "Versão e SHA-256", width: 23 }],
        docs.map((d) => [d.title, d.category.name, [d.documentNumber, d.issuer].filter(Boolean).join(" · "), fmtDate(d.expiryDate), DOC[d.status]!, d.versions[0] ? `v${d.versions[0].versionNo} ${d.versions[0].sha256}` : "—"]),
        "Nenhum documento.",
      );
      return;
    }
    case "plano-acoes": {
      const [actions, levels] = await Promise.all([prisma.correctiveAction.findMany({ where: { workId: w.id }, orderBy: [{ status: "asc" }, { dueDate: "asc" }] }), prisma.criticalityLevel.findMany()]);
      r.heading("Identificação");
      header(r, w);
      r.heading("Ações corretivas");
      r.table(
        [{ header: "Ação", width: 32 }, { header: "Criticidade", width: 11 }, { header: "Responsável", width: 17 }, { header: "Prazo", width: 10 }, { header: "Situação", width: 14 }, { header: "Evidência", width: 16 }],
        actions.map((a) => [a.title, levels.find((l) => l.code === a.criticality)?.name ?? a.criticality, a.responsibleName, `${fmtDate(a.dueDate)}${["ABERTA", "EM_ANDAMENTO"].includes(a.status) && a.dueDate < today ? " (vencida)" : ""}`, ACTION[a.status]!, a.evidence ?? ""]),
        "Nenhuma ação corretiva.",
      );
      return;
    }
    case "entregas-epi": {
      const deliveries = await prisma.epiDelivery.findMany({ where: { workId: w.id }, include: { catalog: true, person: { select: { name: true } } }, orderBy: { deliveredAt: "asc" } });
      r.heading("Identificação");
      header(r, w);
      r.heading("Entregas registradas");
      r.paragraph("A confirmação de recebimento indica como foi registrada; este relatório não substitui o termo assinado, quando exigido.", { muted: true, size: 8.5 });
      r.table(
        [{ header: "Data", width: 10 }, { header: "Pessoa", width: 22 }, { header: "EPI", width: 24 }, { header: "CA", width: 8 }, { header: "Qtd.", width: 6, align: "right" }, { header: "Recebimento", width: 16 }, { header: "Devolução", width: 14 }],
        deliveries.map((d) => [fmtDate(d.deliveredAt), d.person.name, d.catalog.name, d.catalog.caNumber ?? "—", String(d.quantity), RECEIPT[d.receipt]!, d.returnedAt ? `${d.returnedQuantity} em ${fmtDate(d.returnedAt)}` : "—"]),
        "Nenhuma entrega vinculada a esta obra.",
      );
      return;
    }
    case "cronograma": {
      const [stages, milestones, baseline] = await Promise.all([
        prisma.workStage.findMany({ where: { workId: w.id }, orderBy: { sortOrder: "asc" } }),
        prisma.workMilestone.findMany({ where: { workId: w.id }, orderBy: { plannedDate: "asc" } }),
        prisma.scheduleBaseline.findFirst({ where: { workId: w.id }, orderBy: { version: "desc" } }),
      ]);
      const snap = baseline?.snapshot as { etapas?: { id: string; termino: string }[] } | undefined;
      r.heading("Identificação");
      header(r, w);
      r.fields([["Linha de base", baseline ? `versão ${baseline.version} (${fmtDateTime(baseline.createdAt)}) — ${baseline.reason}` : "não definida"]]);
      r.heading("Etapas");
      r.table(
        [{ header: "Etapa", width: 26 }, { header: "Previsto", width: 18 }, { header: "Realizado", width: 18 }, { header: "Linha de base", width: 11 }, { header: "Desvio", width: 9, align: "right" }, { header: "Avanço", width: 8, align: "right" }, { header: "Atraso", width: 10 }],
        stages.map((s) => {
          const base = snap?.etapas?.find((e) => e.id === s.id)?.termino;
          const end = s.actualEnd ?? s.plannedEnd;
          const dev = base && end ? Math.round((end.getTime() - new Date(base).getTime()) / 86_400_000) : null;
          return [s.name, `${fmtDate(s.plannedStart)} a ${fmtDate(s.plannedEnd)}`, `${fmtDate(s.actualStart)} a ${fmtDate(s.actualEnd)}`, base ? fmtDate(new Date(base)) : "—", dev === null ? "—" : `${dev > 0 ? "+" : ""}${dev} d`, `${s.progress}%`, s.delayReason ?? ""];
        }),
        "Nenhuma etapa.",
      );
      r.heading("Marcos");
      r.table([{ header: "Marco", width: 50 }, { header: "Previsto", width: 25 }, { header: "Realizado", width: 25 }], milestones.map((m) => [m.name, fmtDate(m.plannedDate), fmtDate(m.actualDate)]), "Nenhum marco.");
      return;
    }
    case "orcamento-medicoes": {
      const [summary, approved, measurements, costs] = await Promise.all([
        budgetSummary(prisma, w.id),
        prisma.budget.findFirst({ where: { workId: w.id, status: "APROVADO" }, include: { lines: { orderBy: { sortOrder: "asc" } } } }),
        prisma.measurement.findMany({ where: { workId: w.id }, orderBy: { number: "asc" } }),
        prisma.costEntry.findMany({ where: { workId: w.id, status: { in: ["REGISTRADO", "APROVADO"] } }, orderBy: { date: "asc" } }),
      ]);
      r.heading("Identificação");
      header(r, w);
      r.heading(`Resumo por categoria (orçamento aprovado ${summary.approvedVersion ? `v${summary.approvedVersion}` : "inexistente"})`);
      r.table(
        [{ header: "Categoria", width: 16 }, { header: "Orçado", width: 14, align: "right" }, { header: "Contratado", width: 14, align: "right" }, { header: "Comprometido", width: 14, align: "right" }, { header: "Medido", width: 14, align: "right" }, { header: "Pago", width: 14, align: "right" }, { header: "Desvio", width: 14, align: "right" }],
        [...summary.rows.map((x) => [CAT[x.category]!, brl(x.orcado), brl(x.contratado), brl(x.comprometido), brl(x.medido), brl(x.pago), `${x.desvioPct}%${x.alerta ? " ⚠" : ""}`]),
          ["Total", brl(summary.totals.orcado), brl(summary.totals.contratado), brl(summary.totals.comprometido), brl(summary.totals.medido), brl(summary.totals.pago), ""]],
      );
      if (approved) {
        r.heading("Itens do orçamento aprovado");
        r.table(
          [{ header: "Descrição", width: 40 }, { header: "Qtd.", width: 12, align: "right" }, { header: "Un.", width: 8 }, { header: "Preço unit.", width: 18, align: "right" }, { header: "Total", width: 22, align: "right" }],
          approved.lines.map((l) => [l.description, l.quantity.toString(), l.unit, brl(l.unitPrice), brl(l.quantity.mul(l.unitPrice).toDecimalPlaces(2))]),
        );
      }
      r.heading("Medições");
      r.table([{ header: "Nº", width: 8 }, { header: "Período", width: 34 }, { header: "Situação", width: 22 }, { header: "Total", width: 36, align: "right" }], measurements.map((m) => [String(m.number), `${fmtDate(m.periodStart)} a ${fmtDate(m.periodEnd)}`, m.status.toLowerCase(), brl(m.total)]), "Nenhuma medição.");
      r.heading("Lançamentos");
      r.paragraph("Lançamentos são registros: o sistema não executa pagamentos.", { muted: true, size: 8.5 });
      r.table([{ header: "Data", width: 12 }, { header: "Tipo", width: 14 }, { header: "Categoria", width: 16 }, { header: "Descrição", width: 38 }, { header: "Valor", width: 20, align: "right" }], costs.map((c) => [fmtDate(c.date), c.kind.toLowerCase(), CAT[c.category]!, c.description, brl(c.amount)]), "Nenhum lançamento.");
      return;
    }
    case "fotografico": {
      const photos = await prisma.document.findMany({ where: { workId: w.id, categoryCode: "FOTO" }, include: { versions: { where: { supersededAt: null } } }, orderBy: { createdAt: "asc" } });
      r.heading("Identificação");
      header(r, w);
      r.heading(`Registros fotográficos (${photos.length})`);
      if (!photos.length) r.paragraph("Nenhum documento da categoria Registro fotográfico.", { muted: true });
      for (const p of photos) {
        const v = p.versions[0];
        if (!v) continue;
        r.paragraph(`${p.title} · enviado em ${fmtDateTime(v.uploadedAt)}`);
        if (v.mimeType === "image/jpeg" || v.mimeType === "image/png") {
          const bytes = await getStorage().read(v.storageKey);
          r.image(Buffer.from(bytes));
        } else {
          r.paragraph(`Formato ${v.mimeType} não incorporado ao PDF; consulte o arquivo original (SHA-256 ${v.sha256}).`, { muted: true, size: 8.5 });
        }
      }
      return;
    }
    case "termo-vistoria":
    case "encerramento": {
      const [approval, history, actions, docs, stages, summary] = await Promise.all([
        prisma.approval.findFirst({ where: { workId: w.id, kind: "ENCERRAMENTO_OBRA" }, orderBy: { createdAt: "desc" }, include: { steps: { orderBy: { stepNo: "asc" } } } }),
        prisma.workStatusChange.findMany({ where: { workId: w.id }, orderBy: { createdAt: "asc" } }),
        prisma.correctiveAction.findMany({ where: { workId: w.id } }),
        prisma.document.findMany({ where: { workId: w.id }, select: { status: true } }),
        prisma.workStage.findMany({ where: { workId: w.id }, orderBy: { sortOrder: "asc" } }),
        canOnWork(actor, "budget.read", w) ? budgetSummary(prisma, w.id) : Promise.resolve(null),
      ]);
      if (type === "termo-vistoria" && !approval) throw Errors.conflict("A obra ainda não foi enviada para vistoria.");
      const names = await people([approval?.requesterId, ...(approval?.steps.map((s) => s.approverId) ?? []), ...history.map((h) => h.actorId)]);
      const open = actions.filter((a) => ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO_VALIDACAO"].includes(a.status));
      r.heading("Identificação");
      header(r, w);
      const started = history.find((h) => h.toStatus === "EM_EXECUCAO");
      const finished = [...history].reverse().find((h) => h.toStatus === "CONCLUIDA");
      r.fields([
        ["Início da execução", started ? fmtDateTime(started.createdAt) : "—"],
        [type === "termo-vistoria" ? "Envio para vistoria" : "Conclusão", type === "termo-vistoria" ? (approval ? fmtDateTime(approval.createdAt) : "—") : finished ? fmtDateTime(finished.createdAt) : "não concluída"],
        ["Etapas concluídas", `${stages.filter((s) => s.status === "CONCLUIDA").length} de ${stages.length}`],
        ["Ações corretivas em aberto", String(open.length)],
        ["Documentos vencidos ou rejeitados", String(docs.filter((d) => ["VENCIDO", "REJEITADO"].includes(d.status)).length)],
      ]);
      r.heading("Escopo executado");
      r.paragraph(w.scope);
      if (open.length) {
        r.heading("Pendências em aberto");
        r.table([{ header: "Ação", width: 60 }, { header: "Prazo", width: 20 }, { header: "Situação", width: 20 }], open.map((a) => [a.title, fmtDate(a.dueDate), ACTION[a.status]!]));
      }
      if (summary && type === "encerramento") {
        r.heading("Resultado financeiro");
        r.fields([["Orçado", brl(summary.totals.orcado)], ["Medido", brl(summary.totals.medido)], ["Contratado + comprometido", brl(summary.totals.contratado + summary.totals.comprometido)], ["Pago (registrado)", brl(summary.totals.pago)]]);
      }
      r.heading("Pareceres da vistoria");
      r.table(
        [{ header: "Decisão", width: 14 }, { header: "Responsável", width: 24 }, { header: "Data", width: 18 }, { header: "Parecer", width: 44 }],
        (approval?.steps ?? []).map((s) => [s.decision.toLowerCase(), names.get(s.approverId) ?? "—", fmtDateTime(s.decidedAt), s.opinion]),
        "Sem decisões registradas.",
      );
      r.heading("Formalização");
      r.paragraph("Este termo é um documento gerencial emitido pelo sistema e não contém assinaturas. Para ter valor formal, deve ser assinado pelos responsáveis por meio próprio (assinatura física ou certificado digital) e arquivado como documento da obra.", { size: 9 });
      return;
    }
    default:
      throw Errors.invalid("Relatório desconhecido.");
  }
}

async function generalReport(actor: Actor, type: ReportType, r: Report, q: { unitId?: string; from?: Date; to?: Date; action?: string }) {
  switch (type) {
    case "documentos-pendentes": {
      const scope = workScopedWhere(actor, "document.read", "workId");
      if (!scope) throw Errors.forbidden();
      await markExpiredDocuments(prisma);
      const today = startOfToday();
      const in30 = new Date(today.getTime() + 30 * 86_400_000);
      const docs = await prisma.document.findMany({
        where: { AND: [scope, { OR: [{ status: { in: ["VENCIDO", "ENVIADO", "EM_REVISAO", "REJEITADO"] } }, { status: "APROVADO", expiryDate: { gte: today, lte: in30 } }] }] },
        include: { work: { select: { code: true } }, person: { select: { name: true } }, company: { select: { legalName: true } }, equipment: { select: { name: true } }, category: true },
        orderBy: [{ status: "asc" }, { expiryDate: "asc" }],
        take: 2000,
      });
      r.heading(`Documentos que exigem atenção (${docs.length})`);
      r.table(
        [{ header: "Situação", width: 14 }, { header: "Documento", width: 30 }, { header: "Categoria", width: 18 }, { header: "Vinculado a", width: 24 }, { header: "Validade", width: 14 }],
        docs.map((d) => [d.status === "APROVADO" ? "Vence em 30 dias" : DOC[d.status]!, d.title, d.category.name, d.work?.code ?? d.person?.name ?? d.company?.legalName ?? d.equipment?.name ?? "—", fmtDate(d.expiryDate)]),
        "Nenhum documento pendente, vencido ou a vencer.",
      );
      return;
    }
    case "consolidado-regiao": {
      const scope = workScopedWhere(actor, "work.read", "id");
      if (!scope) throw Errors.forbidden();
      const parent = q.unitId ? await prisma.organizationUnit.findUnique({ where: { id: q.unitId } }) : await getRootUnit();
      if (!parent || !can(actor, "org.read", parent.path)) throw Errors.notFound("Unidade");
      const children = await prisma.organizationUnit.findMany({ where: { parentId: parent.id }, orderBy: { name: "asc" } });
      const groups = children.length ? children : [parent];
      r.heading(`Unidades subordinadas a ${parent.name}`);
      const rows: string[][] = [];
      for (const g of groups) {
        if (!can(actor, "org.read", g.path) && !grantsFor(actor, "work.read").some((x) => x.path.startsWith(g.path))) continue;
        const where: Prisma.WorkWhereInput = { AND: [scope, { unitPath: { startsWith: g.path } }] };
        const works = await prisma.work.findMany({ where, select: { id: true, status: true } });
        const ids = works.map((w) => w.id);
        const [budget, open, late] = await Promise.all([
          prisma.budget.aggregate({ where: { workId: { in: ids }, status: "APROVADO" }, _sum: { total: true } }),
          prisma.correctiveAction.count({ where: { workId: { in: ids }, status: { in: ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO_VALIDACAO"] } } }),
          prisma.document.count({ where: { workId: { in: ids }, status: "VENCIDO" } }),
        ]);
        const count = (s: string[]) => works.filter((w) => s.includes(w.status)).length;
        rows.push([g.name, String(works.length), String(count(["RASCUNHO", "SOLICITADA", "EM_TRIAGEM", "EM_APROVACAO", "APROVADA"])), String(count(["EM_EXECUCAO", "EM_VISTORIA"])), String(count(["SUSPENSA"])), String(count(["CONCLUIDA"])), brl(Number(budget._sum.total ?? 0)), String(open), String(late)]);
      }
      r.table(
        [{ header: "Unidade", width: 22 }, { header: "Obras", width: 7, align: "right" }, { header: "Planej.", width: 8, align: "right" }, { header: "Execução", width: 9, align: "right" }, { header: "Susp.", width: 7, align: "right" }, { header: "Concl.", width: 7, align: "right" }, { header: "Orçado aprovado", width: 16, align: "right" }, { header: "Ações abertas", width: 12, align: "right" }, { header: "Doc. vencidos", width: 12, align: "right" }],
        rows,
        "Nenhuma unidade no seu escopo.",
      );
      return;
    }
    case "auditoria": {
      const grants = grantsFor(actor, "audit.read");
      if (!grants.length) throw Errors.forbidden();
      const root = await getRootUnit();
      const scopeOr: Prisma.AuditEventWhereInput[] = grants.map((g) => (g.includeDescendants ? { unitPath: { startsWith: g.path } } : { unitPath: g.path }));
      if (root && can(actor, "audit.read", root.path)) scopeOr.push({ unitPath: null });
      const events = await prisma.auditEvent.findMany({
        where: { AND: [{ OR: scopeOr }, q.action ? { action: { startsWith: q.action } } : {}, q.from || q.to ? { occurredAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}] },
        orderBy: { seq: "desc" },
        take: 2000,
      });
      r.heading(`Eventos (${events.length}${events.length === 2000 ? ", limitado aos 2.000 mais recentes" : ""})`);
      r.paragraph(`Filtros: ação ${q.action ?? "todas"} · período ${q.from ? fmtDate(q.from) : "início"} a ${q.to ? fmtDate(q.to) : "hoje"}. Restrito ao escopo de auditoria de quem gerou.`, { muted: true, size: 8.5 });
      r.table(
        [{ header: "Nº", width: 7 }, { header: "Data/hora", width: 16 }, { header: "Ação", width: 25 }, { header: "Ator", width: 22 }, { header: "Resultado", width: 10 }, { header: "Hash", width: 20 }],
        events.map((e) => [e.seq.toString(), fmtDateTime(e.occurredAt), e.action, e.actorLabel ?? "—", e.result.toLowerCase(), e.hash.slice(0, 16)]),
      );
      return;
    }
    default:
      throw Errors.invalid("Relatório desconhecido.");
  }
}

/** Gera qualquer relatório do catálogo. Obras: exige workId; gerais: filtros opcionais. */
export async function generateReport(actor: Actor, type: ReportType, q: { workId?: string; unitId?: string; from?: Date; to?: Date; action?: string }, meta: RequestMeta) {
  const def = REPORTS[type];
  if (!def) throw Errors.notFound("Relatório");
  if (!canAnywhere(actor, def.permission) || !canAnywhere(actor, "report.generate")) throw Errors.forbidden("Você não pode gerar este relatório.");
  let r: Report;
  let fileBase: string;
  let unitPath: string | null = null;
  if (def.scope === "obra") {
    if (!q.workId) throw Errors.invalid("Selecione a obra.", { workId: ["Obra obrigatória."] });
    const w = await workFor(actor, q.workId, def.permission);
    r = new Report({ title: `${def.title} — ${w.code}`, subject: `${w.title} · ${w.unit.name}`, generatedBy: actor.name });
    await workReport(actor, type, w, r);
    fileBase = `${type}-${w.code}`;
    unitPath = w.unitPath;
  } else {
    r = new Report({ title: def.title, subject: "Dados restritos ao escopo de acesso de quem gerou o relatório", generatedBy: actor.name });
    await generalReport(actor, type, r, q);
    fileBase = `${type}-${new Date().toISOString().slice(0, 10)}`;
  }
  const pdf = await r.finish();
  await recordAudit({ action: `relatorio.${type}.gerado`, actor: { userId: actor.userId, email: actor.email }, objectType: "Report", objectId: q.workId ?? type, unitPath, metadata: { relatorio: type, filtros: { unidade: q.unitId, acao: q.action } } }, meta);
  return { pdf, fileName: `${fileBase}.pdf` };
}
