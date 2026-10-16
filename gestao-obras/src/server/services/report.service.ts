import { prisma } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCanOnWork, canOnWork, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import { STATUS_LABEL } from "../domain/work-state";
import { fmtDate, fmtDateTime, Report } from "../reports/pdf";
import { listWorkRequirements } from "./requirement.service";
import { markExpiredDocuments } from "./document.service";

const DOC_STATUS: Record<string, string> = { ENVIADO: "Enviado", EM_REVISAO: "Em revisão", APROVADO: "Aprovado", REJEITADO: "Rejeitado", VENCIDO: "Vencido", SUBSTITUIDO: "Substituído" };
const EVAL_STATUS: Record<string, string> = { PENDENTE: "Pendente", ATENDIDO: "Atendido", NAO_ATENDIDO: "Não atendido", DISPENSADO_JUSTIFICADO: "Dispensado (justificado)", NAO_APLICAVEL: "Não aplicável" };
const RULE_STATUS: Record<string, string> = { PENDENTE_VALIDACAO: "Pendente de confirmação", VALIDADA: "Validada", INATIVA: "Inativa" };
const DECISION: Record<string, string> = { APROVAR: "Aprovou", REJEITAR: "Rejeitou", DEVOLVER: "Devolveu" };
const APPROVAL_KIND: Record<string, string> = { SOLICITACAO_OBRA: "Solicitação de obra", ENCERRAMENTO_OBRA: "Vistoria e encerramento" };

/** Dossiê completo da obra (versão inicial da Fase 2). */
export async function generateWorkDossier(actor: Actor, workId: string, meta: RequestMeta) {
  const base = await prisma.work.findUnique({ where: { id: workId } });
  if (!base || !canOnWork(actor, "work.read", base)) throw Errors.notFound("Obra");
  assertCanOnWork(actor, "report.generate", base, "Você não pode gerar relatórios desta obra.");
  await markExpiredDocuments(prisma, { workId });
  const work = await prisma.work.findUniqueOrThrow({
    where: { id: workId },
    include: {
      unit: true,
      type: true,
      stages: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      statusHistory: { orderBy: { createdAt: "asc" } },
      approvals: { orderBy: { createdAt: "asc" }, include: { steps: { orderBy: { stepNo: "asc" } } } },
      documents: { include: { category: true, versions: { orderBy: { versionNo: "desc" } } }, orderBy: [{ categoryCode: "asc" }, { createdAt: "asc" }] },
    },
  });
  const canReadReqs = canOnWork(actor, "requirement.read", work);
  const requirements = canReadReqs ? await listWorkRequirements(actor, workId) : [];
  const activities = await prisma.activityType.findMany({ where: { code: { in: work.activities } } });
  const userIds = [work.createdById, ...work.statusHistory.map((h) => h.actorId), ...work.approvals.flatMap((a) => [a.requesterId, ...a.steps.map((s) => s.approverId)])];
  const people = new Map((await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));

  const r = new Report({ title: `Dossiê da obra ${work.code}`, subject: `${work.title} · ${work.unit.name}`, generatedBy: actor.name });
  r.heading("Identificação");
  r.fields([
    ["Código", work.code],
    ["Situação", STATUS_LABEL[work.status]],
    ["Unidade", `${work.unit.name} (${work.unit.code})`],
    ["Tipo de obra", work.type.name],
    ["Prioridade", work.priority],
    ["Forma de execução", { VOLUNTARIOS: "Voluntários", EMPRESA_CONTRATADA: "Empresa contratada", MISTA: "Mista" }[work.executionMode]],
    ["Atividades", activities.map((a) => a.name).join(", ") || "Nenhuma informada"],
    ["Responsável", work.responsibleName],
    ["Início previsto", fmtDate(work.plannedStart)],
    ["Término previsto", fmtDate(work.plannedEnd)],
    ["Endereço", [work.street, work.number, work.district, work.city && `${work.city}/${work.state ?? ""}`, work.postalCode].filter(Boolean).join(", ")],
    ["Cadastrada por", `${people.get(work.createdById) ?? "—"} em ${fmtDateTime(work.createdAt)}`],
  ]);
  r.heading("Escopo");
  r.paragraph(work.scope);
  r.heading("Justificativa");
  r.paragraph(work.justification);

  r.heading("Etapas");
  r.table(
    [{ header: "Etapa", width: 34 }, { header: "Situação", width: 16 }, { header: "Previsto", width: 22 }, { header: "Realizado", width: 22 }, { header: "Avanço", width: 10, align: "right" }],
    work.stages.map((s) => [s.name, s.status.replace("_", " ").toLowerCase(), `${fmtDate(s.plannedStart)} a ${fmtDate(s.plannedEnd)}`, `${fmtDate(s.actualStart)} a ${fmtDate(s.actualEnd)}`, `${s.progress}%`]),
    "Nenhuma etapa cadastrada.",
  );

  if (canReadReqs) {
    r.heading("Requisitos documentais aplicáveis");
    r.paragraph("Regras pendentes de confirmação são informativas: ainda não foram validadas por responsável e não representam obrigação jurídica definitiva.", { muted: true, size: 8.5 });
    r.table(
      [{ header: "Requisito", width: 36 }, { header: "Regra", width: 18 }, { header: "Situação", width: 18 }, { header: "Evidência / justificativa", width: 28 }],
      requirements.map((e) => [e.rule.name, RULE_STATUS[e.rule.status]!, EVAL_STATUS[e.status]!, e.document ? `Documento: ${e.document.title}` : e.justification ?? ""]),
      "Nenhum requisito aplicável.",
    );
  }

  const milestones = await prisma.workMilestone.findMany({ where: { workId }, orderBy: { plannedDate: "asc" } });
  if (milestones.length) {
    r.heading("Marcos do cronograma");
    r.table([{ header: "Marco", width: 50 }, { header: "Previsto", width: 25 }, { header: "Realizado", width: 25 }], milestones.map((m) => [m.name, fmtDate(m.plannedDate), fmtDate(m.actualDate)]));
  }

  r.heading("Documentos");
  r.table(
    [{ header: "Documento", width: 30 }, { header: "Categoria", width: 18 }, { header: "Situação", width: 12 }, { header: "Validade", width: 11 }, { header: "Versão / SHA-256", width: 29 }],
    work.documents.map((d) => {
      const v = d.versions[0];
      return [d.title, d.category.name, DOC_STATUS[d.status]!, fmtDate(d.expiryDate), v ? `v${v.versionNo} · ${v.sha256}` : "—"];
    }),
    "Nenhum documento enviado.",
  );

  if (canOnWork(actor, "safety.read", work)) {
    const [inspections, actions] = await Promise.all([
      prisma.inspection.count({ where: { workId, status: "CONCLUIDA" } }),
      prisma.correctiveAction.findMany({ where: { workId }, orderBy: { dueDate: "asc" } }),
    ]);
    r.heading("Segurança");
    r.paragraph(`${inspections} inspeção(ões) concluída(s) · ${actions.length} ação(ões) corretiva(s), ${actions.filter((a) => ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO_VALIDACAO"].includes(a.status)).length} em aberto.`);
    if (actions.length) r.table([{ header: "Ação", width: 50 }, { header: "Prazo", width: 20 }, { header: "Situação", width: 30 }], actions.map((a) => [a.title, fmtDate(a.dueDate), a.status.toLowerCase().replace(/_/g, " ")]));
  }

  if (canOnWork(actor, "budget.read", work)) {
    const { budgetSummary } = await import("./budget.service");
    const b = await budgetSummary(prisma, workId);
    const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    r.heading("Orçamento");
    r.fields([["Versão aprovada", b.approvedVersion ? `v${b.approvedVersion}` : "nenhuma"], ["Orçado", brl(b.totals.orcado)], ["Contratado + comprometido", brl(b.totals.contratado + b.totals.comprometido)], ["Medido", brl(b.totals.medido)], ["Pago (registrado)", brl(b.totals.pago)], ["Saldo a comprometer", brl(b.totals.saldo)]]);
  }

  r.heading("Histórico de situação");
  r.table(
    [{ header: "Data", width: 20 }, { header: "De → para", width: 28 }, { header: "Responsável", width: 22 }, { header: "Justificativa", width: 30 }],
    work.statusHistory.map((h) => [fmtDateTime(h.createdAt), `${h.fromStatus ? STATUS_LABEL[h.fromStatus] : "—"} → ${STATUS_LABEL[h.toStatus]}`, people.get(h.actorId) ?? "—", h.reason ?? ""]),
  );

  r.heading("Aprovações");
  if (!work.approvals.length) r.paragraph("Nenhuma aprovação registrada.", { muted: true });
  for (const a of work.approvals) {
    r.paragraph(`${APPROVAL_KIND[a.kind]} · versão ${a.subjectVersion} · solicitada por ${people.get(a.requesterId) ?? "—"} em ${fmtDateTime(a.createdAt)} · situação: ${a.status.toLowerCase()}`);
    r.table(
      [{ header: "Decisão", width: 14 }, { header: "Aprovador", width: 22 }, { header: "Data", width: 18 }, { header: "Parecer", width: 46 }],
      a.steps.map((s) => [DECISION[s.decision]!, people.get(s.approverId) ?? "—", fmtDateTime(s.decidedAt), s.opinion]),
      "Sem decisões registradas.",
    );
  }

  const pdf = await r.finish();
  await recordAudit(
    { action: "relatorio.dossie.gerado", actor: { userId: actor.userId, email: actor.email }, objectType: "Work", objectId: work.id, unitPath: work.unitPath, metadata: { obra: work.code, bytes: pdf.length } },
    meta,
  );
  return { pdf, fileName: `dossie-${work.code}.pdf` };
}

const RESULT: Record<string, string> = { PENDENTE: "Pendente", CONFORME: "Conforme", NAO_CONFORME: "Não conforme", NAO_APLICAVEL: "Não se aplica" };
const ACTION_STATUS: Record<string, string> = { ABERTA: "Aberta", EM_ANDAMENTO: "Em andamento", AGUARDANDO_VALIDACAO: "Aguardando validação", ENCERRADA: "Encerrada", CANCELADA: "Cancelada" };

/** Relatório de inspeção com itens, criticidade e ações geradas. */
export async function generateInspectionReport(actor: Actor, inspectionId: string, meta: RequestMeta) {
  const ins = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { work: { include: { unit: true } }, items: { orderBy: { sortOrder: "asc" }, include: { correctiveActions: true } } },
  });
  if (!ins || !canOnWork(actor, "safety.read", ins.work)) throw Errors.notFound("Inspeção");
  assertCanOnWork(actor, "report.generate", ins.work, "Você não pode gerar relatórios desta obra.");
  const [inspector, levels] = await Promise.all([prisma.user.findUnique({ where: { id: ins.inspectorId }, select: { name: true } }), prisma.criticalityLevel.findMany()]);
  const level = (c: string) => levels.find((l) => l.code === c)?.name ?? c;
  const r = new Report({ title: `Relatório de inspeção — ${ins.work.code}`, subject: `${ins.title} · ${ins.work.title} · ${ins.work.unit.name}`, generatedBy: actor.name });
  r.heading("Identificação");
  r.fields([
    ["Obra", `${ins.work.code} — ${ins.work.title}`],
    ["Unidade", ins.work.unit.name],
    ["Data prevista", fmtDate(ins.plannedDate)],
    ["Realizada em", fmtDateTime(ins.performedAt)],
    ["Local", ins.location],
    ["Responsável", inspector?.name ?? "—"],
    ["Situação", ins.status.toLowerCase()],
    ["Não conformidades", String(ins.items.filter((i) => i.result === "NAO_CONFORME").length)],
  ]);
  r.heading("Itens verificados");
  r.table(
    [{ header: "Item", width: 44 }, { header: "Resultado", width: 14 }, { header: "Criticidade", width: 12 }, { header: "Observação", width: 30 }],
    ins.items.map((i) => [i.text, RESULT[i.result]!, i.result === "NAO_CONFORME" ? level(i.criticality) : "—", i.observation ?? ""]),
  );
  const actions = ins.items.flatMap((i) => i.correctiveActions);
  r.heading("Ações corretivas geradas");
  r.table(
    [{ header: "Ação", width: 44 }, { header: "Responsável", width: 22 }, { header: "Prazo", width: 14 }, { header: "Situação", width: 20 }],
    actions.map((a) => [a.title, a.responsibleName, fmtDate(a.dueDate), ACTION_STATUS[a.status]!]),
    "Nenhuma ação gerada.",
  );
  r.heading("Conclusão");
  r.paragraph(ins.summary ?? "Inspeção ainda não concluída.");
  const pdf = await r.finish();
  await recordAudit({ action: "relatorio.inspecao.gerado", actor: { userId: actor.userId, email: actor.email }, objectType: "Inspection", objectId: ins.id, unitPath: ins.unitPath, metadata: { obra: ins.work.code } }, meta);
  return { pdf, fileName: `inspecao-${ins.work.code}-${ins.plannedDate.toISOString().slice(0, 10)}.pdf` };
}
