import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { MemoryStorage, setStorage } from "@/server/storage/storage";
import { createStage, createWork, transitionWork } from "@/server/services/work.service";
import { decideApproval, replaceTiers } from "@/server/services/approval.service";
import { addDiaryEntry, createBaseline, hasCycle, requestScopeChange, saveMilestone, updateStageSchedule } from "@/server/services/schedule.service";
import { addCost, budgetSummary, createBudget, saveBudgetLine, saveMeasurement, submitBudget, submitMeasurement } from "@/server/services/budget.service";
import { applyRetention, closePrivacyRequest, exportSubjectData, openPrivacyRequest } from "@/server/services/privacy.service";
import { createPerson } from "@/server/services/people.service";
import { updateSetting } from "@/server/services/settings.service";
import { generateReport, REPORTS, type ReportType } from "@/server/services/reports-extra.service";
import { actorOf, makeTree, makeUser, meta } from "./fixtures";

let t: Awaited<ReturnType<typeof makeTree>>;
let gestorA: Awaited<ReturnType<typeof makeUser>>;
let gestorB: Awaited<ReturnType<typeof makeUser>>;
let analista: Awaited<ReturnType<typeof makeUser>>;
let analista2: Awaited<ReturnType<typeof makeUser>>;
let admin: Awaited<ReturnType<typeof makeUser>>;

const base = (unitId: string) => ({ unitId, title: "Obra fase 4", typeCode: "REFORMA", activities: [], priority: "MEDIA", executionMode: "EMPRESA_CONTRATADA", scope: "Escopo original.", justification: "Justificativa original." }) as never;

beforeAll(async () => {
  setStorage(new MemoryStorage());
  t = await makeTree();
  admin = await makeUser({ unit: t.root, role: "ADMIN_SISTEMA" });
  gestorA = await makeUser({ unit: t.regA, role: "GESTOR_REGIONAL" });
  gestorB = await makeUser({ unit: t.regB, role: "GESTOR_REGIONAL" });
  analista = await makeUser({ unit: t.root, role: "ANALISTA_CENTRAL" });
  analista2 = await makeUser({ unit: t.root, role: "ANALISTA_CENTRAL" });
});

async function approvedWork() {
  const a = await actorOf(gestorA);
  const w = await createWork(a, base(t.a1.id), meta());
  let cur = await transitionWork(a, w.id, { action: "solicitar", version: w.version }, meta());
  cur = await transitionWork(a, w.id, { action: "iniciar_triagem", version: cur.version }, meta());
  await transitionWork(a, w.id, { action: "enviar_aprovacao", version: cur.version }, meta());
  const ap = await prisma.approval.findFirstOrThrow({ where: { workId: w.id, status: "PENDENTE" } });
  await decideApproval(await actorOf(analista), ap.id, { decision: "APROVAR", opinion: "Aprovado para teste.", consultedDocumentIds: [] }, meta());
  return prisma.work.findUniqueOrThrow({ where: { id: w.id } });
}

const approve = async (workId: string, kind: string, who = analista) => {
  const ap = await prisma.approval.findFirstOrThrow({ where: { workId, kind: kind as never, status: "PENDENTE" } });
  return decideApproval(await actorOf(who), ap.id, { decision: "APROVAR", opinion: "De acordo com a análise.", consultedDocumentIds: [] }, meta());
};

describe("cronograma", () => {
  it("detecta ciclos de dependência", () => {
    expect(hasCycle(new Map([["a", ["b"]], ["b", ["c"]], ["c", []]]))).toBe(false);
    expect(hasCycle(new Map([["a", ["b"]], ["b", ["c"]], ["c", ["a"]]]))).toBe(true);
  });

  it("dependências, marcos, linhas de base versionadas e diário somente inclusão", async () => {
    const a = await actorOf(gestorA);
    const w = await createWork(a, base(t.a1.id), meta());
    const s1 = await createStage(a, w.id, { name: "Fundação", sortOrder: 1, status: "NAO_INICIADA", progress: 0 } as never, meta());
    const s2 = await createStage(a, w.id, { name: "Estrutura", sortOrder: 2, status: "NAO_INICIADA", progress: 0 } as never, meta());
    await updateStageSchedule(a, w.id, s2.id, { dependsOnIds: [s1.id], delayReason: null }, meta());
    await expect(updateStageSchedule(a, w.id, s1.id, { dependsOnIds: [s2.id], delayReason: null }, meta())).rejects.toMatchObject({ status: 422 });
    await expect(createBaseline(a, w.id, "Planejamento inicial", meta())).rejects.toMatchObject({ status: 422 });
    await prisma.workStage.updateMany({ where: { workId: w.id }, data: { plannedStart: new Date("2026-01-01"), plannedEnd: new Date("2026-02-01") } });
    await saveMilestone(a, w.id, null, { name: "Entrega da estrutura", kind: "ENTREGA", plannedDate: new Date("2026-02-01") } as never, meta());
    const b1 = await createBaseline(a, w.id, "Planejamento inicial", meta());
    const b2 = await createBaseline(a, w.id, "Revisão após chuvas", meta());
    expect([b1.version, b2.version]).toEqual([1, 2]);
    await expect(addDiaryEntry(a, w.id, { date: new Date(Date.now() + 2 * 86_400_000), activities: "Futuro" } as never, meta())).rejects.toMatchObject({ status: 422 });
    await addDiaryEntry(a, w.id, { date: new Date("2026-01-10"), activities: "Escavação das sapatas.", workforce: 6 } as never, meta());
    await expect(createBaseline(await actorOf(gestorB), w.id, "Invasão", meta())).rejects.toMatchObject({ status: 404 });
  });

  it("mudança de escopo de obra aprovada passa pela aprovação e é aplicada", async () => {
    const w = await approvedWork();
    const a = await actorOf(gestorA);
    const sc = await requestScopeChange(a, w.id, { proposedScope: "Escopo ampliado com calhas.", proposedJustification: "Nova infiltração identificada.", reason: "Vistoria técnica" }, meta());
    await expect(requestScopeChange(a, w.id, { proposedScope: "x", proposedJustification: "y", reason: "z" }, meta())).rejects.toMatchObject({ status: 409 });
    const ap = await prisma.approval.findFirstOrThrow({ where: { subjectId: sc.id } });
    await expect(decideApproval(a, ap.id, { decision: "APROVAR", opinion: "Aprovando a minha.", consultedDocumentIds: [] }, meta())).rejects.toMatchObject({ status: 403 });
    await approve(w.id, "MUDANCA_ESCOPO");
    const updated = await prisma.work.findUniqueOrThrow({ where: { id: w.id } });
    expect(updated.scope).toBe("Escopo ampliado com calhas.");
    expect((await prisma.scopeChange.findUniqueOrThrow({ where: { id: sc.id } })).status).toBe("APROVADA");
  });
});

describe("orçamento, despesas e medições", () => {
  it("valores exatos, versões aprovadas, despesas com alçada por valor, medições e desvio", async () => {
    const w = await approvedWork();
    const a = await actorOf(gestorA);
    const v1 = await createBudget(a, w.id, { reason: "Orçamento inicial", copyFromApproved: true }, meta());
    await saveBudgetLine(a, w.id, v1.id, null, { category: "MATERIAIS", description: "Telhas", unit: "un", quantity: 3, unitPrice: 0.1 }, meta());
    await saveBudgetLine(a, w.id, v1.id, null, { category: "SERVICOS", description: "Mão de obra de cobertura", unit: "m2", quantity: 100, unitPrice: 50 }, meta());
    expect((await prisma.budget.findUniqueOrThrow({ where: { id: v1.id } })).total.toString()).toBe("5000.3");
    await expect(createBudget(a, w.id, { reason: "Outra", copyFromApproved: true }, meta())).rejects.toMatchObject({ status: 409 });
    await submitBudget(a, w.id, v1.id, null, meta());
    await expect(saveBudgetLine(a, w.id, v1.id, null, { category: "OUTRAS", description: "x", unit: "un", quantity: 1, unitPrice: 1 }, meta())).rejects.toMatchObject({ status: 409 });
    await approve(w.id, "ORCAMENTO");
    expect((await prisma.budget.findUniqueOrThrow({ where: { id: v1.id } })).status).toBe("APROVADO");

    // Aditivo: nova versão copia as linhas; ao aprovar, a anterior é substituída.
    const v2 = await createBudget(a, w.id, { reason: "Aditivo de calhas", copyFromApproved: true }, meta());
    const lines = await prisma.budgetLine.findMany({ where: { budgetId: v2.id } });
    expect(lines).toHaveLength(2);
    await saveBudgetLine(a, w.id, v2.id, null, { category: "MATERIAIS", description: "Calhas", unit: "m", quantity: 20, unitPrice: 30 }, meta());
    await submitBudget(a, w.id, v2.id, null, meta());
    await approve(w.id, "ORCAMENTO");
    expect((await prisma.budget.findUniqueOrThrow({ where: { id: v1.id } })).status).toBe("SUBSTITUIDO");

    // Alçada: acima de R$ 1.000, duas decisões.
    await replaceTiers(await actorOf(admin), "DESPESA", [{ upToAmount: 1000, stepsRequired: 1 }, { upToAmount: null, stepsRequired: 2 }], meta());
    try {
      await addCost(a, w.id, { kind: "COMPROMETIDO", category: "MATERIAIS", amount: 5000, date: new Date(), description: "Compra de telhas" } as never, meta());
      const ap = await prisma.approval.findFirstOrThrow({ where: { workId: w.id, kind: "DESPESA", status: "PENDENTE" } });
      expect(ap.stepsRequired).toBe(2);
      expect((await approve(w.id, "DESPESA")).status).toBe("PENDENTE");
      expect((await approve(w.id, "DESPESA", analista2)).status).toBe("APROVADA");
    } finally {
      await replaceTiers(await actorOf(admin), "DESPESA", [], meta());
    }
    await addCost(a, w.id, { kind: "PAGO", category: "MATERIAIS", amount: 1200, date: new Date(), description: "Pagamento registrado" } as never, meta());

    // Medição com preços do orçamento aprovado; acumulado acima do orçado é sinalizado.
    const svc = (await prisma.budgetLine.findFirstOrThrow({ where: { budgetId: v2.id, description: "Mão de obra de cobertura" } })).lineKey;
    const m = await saveMeasurement(a, w.id, null, { periodStart: new Date("2026-03-01"), periodEnd: new Date("2026-03-31"), items: [{ lineKey: svc, quantity: 120 }] } as never, meta());
    expect(m.total.toString()).toBe("6000");
    const { warnings } = await submitMeasurement(a, w.id, m.id, null, meta());
    expect(warnings).toHaveLength(1);
    await approve(w.id, "MEDICAO");

    await updateSetting(await actorOf(admin), "budget.deviationAlertPercent", 10, meta());
    const s = await budgetSummary(prisma, w.id);
    const servicos = s.rows.find((r) => r.category === "SERVICOS")!;
    expect(servicos.orcado).toBe(5000);
    expect(servicos.medido).toBe(6000);
    expect(servicos.desvioPct).toBe(20);
    expect(servicos.alerta).toBe(true);
    expect(s.totals.pago).toBe(1200);
    expect(s.totals.comprometido).toBe(5000);
  });

  it("medição exige orçamento aprovado e gestor de outra região não acessa", async () => {
    const w = await approvedWork();
    await expect(saveMeasurement(await actorOf(gestorA), w.id, null, { periodStart: new Date(), periodEnd: new Date(), items: [] } as never, meta())).rejects.toMatchObject({ status: 409 });
    await expect(createBudget(await actorOf(gestorB), w.id, { reason: "x", copyFromApproved: true }, meta())).rejects.toMatchObject({ status: 404 });
  });
});

describe("privacidade e retenção", () => {
  it("registra solicitação, exporta dados, anonimiza e restringe à gestão central", async () => {
    const p = await createPerson(await actorOf(gestorA), { name: "Titular Fictício", category: "VOLUNTARIO", unitId: t.a1.id, email: "titular@exemplo.test" } as never, meta());
    await expect(openPrivacyRequest(await actorOf(gestorA), { subjectType: "PESSOA", subjectId: p.id, kind: "ACESSO", channel: "e-mail", details: "Pedido de acesso" }, meta())).rejects.toMatchObject({ status: 403 });
    const adm = await actorOf(admin);
    const r = await openPrivacyRequest(adm, { subjectType: "PESSOA", subjectId: p.id, kind: "ANONIMIZACAO", channel: "e-mail", details: "Pedido de anonimização" }, meta());
    const exp = await exportSubjectData(adm, r.id, meta());
    expect(JSON.stringify(exp)).toContain("titular@exemplo.test");
    await closePrivacyRequest(adm, r.id, { status: "ATENDIDA", resolution: "Dados anonimizados; registros de obra mantidos sem identificação.", anonymize: true }, meta());
    const after = await prisma.person.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.name).toMatch(/^Pessoa anonimizada/);
    expect(after.email).toBeNull();
    await expect(closePrivacyRequest(adm, r.id, { status: "ATENDIDA", resolution: "de novo", anonymize: false }, meta())).rejects.toMatchObject({ status: 409 });
  });

  it("descarta tentativas de login antigas conforme o prazo configurado", async () => {
    await prisma.loginAttempt.create({ data: { identifier: "antigo@exemplo.test", success: false, createdAt: new Date("2020-01-01") } });
    const res = await applyRetention();
    expect(res.tentativasLogin).toBeGreaterThanOrEqual(1);
    expect(await prisma.loginAttempt.count({ where: { identifier: "antigo@exemplo.test" } })).toBe(0);
  });
});

describe("relatórios", () => {
  it("gera todos os relatórios do catálogo e respeita o escopo", async () => {
    const w = await approvedWork();
    await prisma.approval.create({ data: { kind: "ENCERRAMENTO_OBRA", workId: w.id, unitPath: w.unitPath, subjectVersion: w.version, snapshot: {}, stepsRequired: 1, requireSegregation: true, requesterId: gestorA.id } });
    const adm = await actorOf(admin);
    for (const type of Object.keys(REPORTS) as ReportType[]) {
      const { pdf } = await generateReport(adm, type, REPORTS[type].scope === "obra" ? { workId: w.id } : {}, meta());
      expect(pdf.subarray(0, 5).toString(), type).toBe("%PDF-");
    }
    await expect(generateReport(await actorOf(gestorB), "resumo-executivo", { workId: w.id }, meta())).rejects.toMatchObject({ status: 404 });
    await expect(generateReport(await actorOf(gestorA), "auditoria", {}, meta())).resolves.toBeTruthy();
    expect(await prisma.auditEvent.count({ where: { action: "relatorio.cronograma.gerado", objectId: w.id } })).toBe(1);
  });
});
