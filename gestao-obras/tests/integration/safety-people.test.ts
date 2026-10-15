import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { MemoryMailer, setMailer } from "@/server/mail/mailer";
import { MemoryStorage, setStorage } from "@/server/storage/storage";
import { isValidCnpj } from "@/server/validation/phase3";
import { createWork, transitionWork } from "@/server/services/work.service";
import { decideApproval } from "@/server/services/approval.service";
import { addAssignment, addCredential, createPerson, getPerson, listPeople, verifyCredential } from "@/server/services/people.service";
import { createCompany, createContract, getCompany, listCompanies, verifyCompany } from "@/server/services/company.service";
import { addMovement, deliver, returnDelivery, stockBalances, lowStock } from "@/server/services/epi.service";
import { addEquipmentLog, createEquipment } from "@/server/services/equipment.service";
import { advanceAction, completeInspection, createAction, createIncident, createInspection, getInspection, listActions, saveInspectionItems, updateCriticality } from "@/server/services/safety.service";
import { generateAlerts, listMyNotifications } from "@/server/services/notification.service";
import { uploadOwnedDocument } from "@/server/services/document.service";
import { actorOf, makeTree, makeUser, meta } from "./fixtures";

const mailer = new MemoryMailer();
let t: Awaited<ReturnType<typeof makeTree>>;
let gestorA: Awaited<ReturnType<typeof makeUser>>;
let gestorB: Awaited<ReturnType<typeof makeUser>>;
let tecnico: Awaited<ReturnType<typeof makeUser>>;
let tecnico2: Awaited<ReturnType<typeof makeUser>>;
let analista: Awaited<ReturnType<typeof makeUser>>;
let admin: Awaited<ReturnType<typeof makeUser>>;
const PDF = new TextEncoder().encode("%PDF-1.4\n%%EOF");

const work = (unitId: string) => ({ unitId, title: "Obra segura", typeCode: "REFORMA", activities: [], priority: "MEDIA", executionMode: "VOLUNTARIOS", scope: "Escopo de teste.", justification: "Justificativa de teste." }) as never;

beforeAll(async () => {
  setMailer(mailer);
  setStorage(new MemoryStorage());
  t = await makeTree();
  admin = await makeUser({ unit: t.root, role: "ADMIN_SISTEMA" });
  gestorA = await makeUser({ unit: t.regA, role: "GESTOR_REGIONAL" });
  gestorB = await makeUser({ unit: t.regB, role: "GESTOR_REGIONAL" });
  tecnico = await makeUser({ unit: t.regA, role: "TECNICO_SEGURANCA" });
  tecnico2 = await makeUser({ unit: t.regA, role: "TECNICO_SEGURANCA" });
  analista = await makeUser({ unit: t.root, role: "ANALISTA_CENTRAL" });
});

async function approvedWork() {
  const a = await actorOf(gestorA);
  const w = await createWork(a, work(t.a1.id), meta());
  let cur = await transitionWork(a, w.id, { action: "solicitar", version: w.version }, meta());
  cur = await transitionWork(a, w.id, { action: "iniciar_triagem", version: cur.version }, meta());
  await transitionWork(a, w.id, { action: "enviar_aprovacao", version: cur.version }, meta());
  const ap = await prisma.approval.findFirstOrThrow({ where: { workId: w.id, status: "PENDENTE" } });
  await decideApproval(await actorOf(analista), ap.id, { decision: "APROVAR", opinion: "Aprovado para testes.", consultedDocumentIds: [] }, meta());
  return prisma.work.findUniqueOrThrow({ where: { id: w.id } });
}

describe("pessoas e vínculos", () => {
  it("cadastra voluntário sem dados sensíveis, registra qualificação e conferência manual; isola regiões", async () => {
    const a = await actorOf(gestorA);
    const p = await createPerson(a, { name: "Voluntário Fictício", category: "VOLUNTARIO", unitId: t.a1.id, authorizedActivities: ["TRABALHO_ALTURA"] } as never, meta());
    const c = await addCredential(a, p.id, { kind: "TREINAMENTO", name: "Treinamento de trabalho em altura", expiryDate: new Date("2020-01-01") } as never, meta());
    expect(c.verifiedAt).toBeNull();
    const v = await verifyCredential(a, p.id, c.id, "Consulta ao certificado original apresentado", meta());
    expect(v.verificationSource).toContain("certificado");
    expect((await listPeople(await actorOf(gestorB))).map((x) => x.id)).not.toContain(p.id);
    await expect(getPerson(await actorOf(gestorB), p.id)).rejects.toMatchObject({ status: 404 });
    await expect(createPerson(a, { name: "Outro", category: "OUTRO", unitId: t.a1.id } as never, meta())).resolves.toBeTruthy();
  });

  it("vínculo com obra avisa sobre atividade não autorizada e integração pendente", async () => {
    const a = await actorOf(gestorA);
    const w = await createWork(a, work(t.a1.id), meta());
    const p = await createPerson(a, { name: "Pessoa Fictícia", category: "PROFISSIONAL", unitId: t.a1.id, authorizedActivities: [] } as never, meta());
    const r = await addAssignment(a, p.id, { workId: w.id, role: "Pedreiro", activities: ["ELETRICIDADE"], startDate: new Date("2026-01-01") } as never, meta());
    expect(r.warnings).toHaveLength(2);
    await expect(addAssignment(await actorOf(gestorB), p.id, { workId: w.id, role: "x", activities: [], startDate: new Date() } as never, meta())).rejects.toMatchObject({ status: 404 });
  });
});

describe("empresas e contratos", () => {
  it("valida CNPJ, não marca validação oficial automaticamente e registra aditivo", async () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    const a = await actorOf(gestorA);
    const cnpj = ["11222333000181", "45723174000110", "11444777000161"][Math.floor(Math.random() * 3)]!;
    await prisma.company.deleteMany({ where: { cnpj } });
    const c = await createCompany(a, { legalName: "Construtora Fictícia Ltda", cnpj, unitId: t.regA.id } as never, meta());
    expect(c.verification).toBe("NAO_VERIFICADA");
    await expect(createCompany(a, { legalName: "Duplicada", cnpj, unitId: t.regA.id } as never, meta())).rejects.toMatchObject({ status: 409 });
    const k = await createContract(a, c.id, { kind: "CONTRATO", number: "001/2026", object: "Execução de reforma", value: 15000.5, status: "VIGENTE" } as never, meta());
    await expect(createContract(a, c.id, { kind: "ADITIVO", number: "001-A", object: "Aditivo de prazo", status: "VIGENTE" } as never, meta())).rejects.toMatchObject({ status: 422 });
    await createContract(a, c.id, { kind: "ADITIVO", number: "001-A", object: "Aditivo de prazo", parentId: k.id, status: "VIGENTE" } as never, meta());
    expect((await getCompany(a, c.id)).contracts).toHaveLength(2);
    const ver = await verifyCompany(a, c.id, "Conferido manualmente no comprovante de inscrição", meta());
    expect(ver.verification).toBe("VERIFICADA_MANUALMENTE");
    expect((await listCompanies(await actorOf(gestorB))).map((x) => x.id)).not.toContain(c.id);
    const doc = await uploadOwnedDocument(a, { kind: "company", id: c.id }, { categoryCode: "CONTRATO", title: "Contrato assinado" } as never, { name: "c.pdf", bytes: PDF }, meta());
    expect(doc.companyId).toBe(c.id);
    await expect(uploadOwnedDocument(await actorOf(gestorB), { kind: "company", id: c.id }, { categoryCode: "CONTRATO", title: "x" } as never, { name: "c.pdf", bytes: PDF }, meta())).rejects.toMatchObject({ status: 404 });
  });
});

describe("EPIs", () => {
  it("controla saldo, impede entrega sem estoque, registra devolução e alerta de mínimo", async () => {
    const adm = await actorOf(admin);
    const item = await prisma.epiCatalog.create({ data: { name: `Capacete teste ${t.suffix}`, epiType: "Cabeça", minStock: 5, caNumber: "12345" } });
    const a = await actorOf(gestorA);
    const p = await createPerson(a, { name: "Receptor Fictício", category: "VOLUNTARIO", unitId: t.a1.id } as never, meta());
    await addMovement(a, { catalogId: item.id, unitId: t.a1.id, type: "ENTRADA", quantity: 6 } as never, meta());
    await expect(deliver(a, { catalogId: item.id, personId: p.id, unitId: t.a1.id, quantity: 7, deliveredAt: new Date(), receipt: "PENDENTE" } as never, meta())).rejects.toMatchObject({ status: 409 });
    const { delivery } = await deliver(a, { catalogId: item.id, personId: p.id, unitId: t.a1.id, quantity: 2, deliveredAt: new Date(), receipt: "TERMO_FISICO_ARQUIVADO" } as never, meta());
    let bal = (await stockBalances(a)).find((b) => b.catalogId === item.id && b.unitId === t.a1.id)!;
    expect(bal.balance).toBe(4);
    expect((await lowStock()).some((l) => l.catalogId === item.id)).toBe(true);
    await returnDelivery(a, delivery.id, { returnedAt: new Date(), returnedQuantity: 1, returnCondition: "Bom estado", restock: true }, meta());
    await expect(returnDelivery(a, delivery.id, { returnedAt: new Date(), returnedQuantity: 1, returnCondition: "x", restock: true }, meta())).rejects.toMatchObject({ status: 409 });
    bal = (await stockBalances(a)).find((b) => b.catalogId === item.id && b.unitId === t.a1.id)!;
    expect(bal.balance).toBe(5);
    // Entregas simultâneas não deixam o saldo negativo.
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => deliver(a, { catalogId: item.id, personId: p.id, unitId: t.a1.id, quantity: 2, deliveredAt: new Date(), receipt: "PENDENTE" } as never, meta())));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect((await stockBalances(a)).find((b) => b.catalogId === item.id && b.unitId === t.a1.id)!.balance).toBe(1);
    await expect(addMovement(await actorOf(gestorB), { catalogId: item.id, unitId: t.a1.id, type: "ENTRADA", quantity: 1 } as never, meta())).rejects.toMatchObject({ status: 404 });
    void adm;
  });
});

describe("equipamentos", () => {
  it("inspeção reprovada interdita e manutenção agenda a próxima data", async () => {
    const a = await actorOf(gestorA);
    const e = await createEquipment(a, { kind: "EQUIPAMENTO_COLETIVO", name: "Andaime fictício", unitId: t.a1.id, inspectionIntervalDays: 30, maintenanceIntervalDays: 90 } as never, meta());
    await addEquipmentLog(a, e.id, { type: "INSPECAO", date: new Date("2026-03-01"), approved: false, notes: "Travamento com defeito", interdict: false }, meta());
    let cur = await prisma.equipment.findUniqueOrThrow({ where: { id: e.id } });
    expect(cur.status).toBe("INTERDITADO");
    expect(cur.nextInspectionAt?.toISOString().slice(0, 10)).toBe("2026-03-31");
    await addEquipmentLog(a, e.id, { type: "MANUTENCAO", date: new Date("2026-03-05"), approved: true, notes: "Travamento substituído", interdict: false }, meta());
    cur = await prisma.equipment.findUniqueOrThrow({ where: { id: e.id } });
    expect(cur.status).toBe("DISPONIVEL");
    await expect(addEquipmentLog(await actorOf(gestorB), e.id, { type: "DEFEITO", date: new Date(), notes: "x", interdict: true }, meta())).rejects.toMatchObject({ status: 404 });
  });
});

describe("inspeções, ações corretivas e bloqueio", () => {
  it("não conformidade crítica gera ação, alerta prioritário e bloqueia o início da execução até a validação por outra pessoa", async () => {
    const w = await approvedWork();
    const tec = await actorOf(tecnico);
    const template = await prisma.checklistTemplate.findFirstOrThrow({ include: { items: true } });
    const ins = await createInspection(tec, { workId: w.id, templateId: template.id, title: "Inspeção inicial", plannedDate: new Date() } as never, meta());
    const detail = await getInspection(tec, ins.id);
    expect(detail.items.length).toBe(template.items.length);
    await expect(completeInspection(tec, ins.id, { summary: "x" } as never, meta())).rejects.toMatchObject({ status: 422 });
    const items = detail.items.map((i, n) => ({ id: i.id, result: n === 0 ? "NAO_CONFORME" : "CONFORME", criticality: n === 0 ? "CRITICA" : i.criticality, observation: n === 0 ? "Guarda-corpo ausente" : null, documentIds: [] }));
    await saveInspectionItems(tec, ins.id, { items, extraItems: [] } as never, meta());
    const { actionsCreated } = await completeInspection(tec, ins.id, { summary: "Uma não conformidade crítica." } as never, meta());
    expect(actionsCreated).toBe(1);

    const [action] = await listActions(tec, { workId: w.id });
    expect(action!.criticality).toBe("CRITICA");
    // Alerta prioritário para quem responde pela obra.
    const notes = await listMyNotifications(await actorOf(gestorA));
    expect(notes.some((n) => n.kind === "seguranca.alerta_prioritario" && n.severity === "CRITICO")).toBe(true);
    expect(mailer.outbox.some((m) => m.subject.startsWith("[CRÍTICO]"))).toBe(true);

    const ga = await actorOf(gestorA);
    await expect(transitionWork(ga, w.id, { action: "iniciar_execucao", version: w.version }, meta())).rejects.toMatchObject({ status: 409 });

    await advanceAction(tec, action!.id, { step: "INICIAR", evidenceDocumentIds: [] }, meta());
    await advanceAction(tec, action!.id, { step: "ENVIAR_EVIDENCIA", evidence: "Guarda-corpo instalado em todo o perímetro.", evidenceDocumentIds: [] }, meta());
    await expect(advanceAction(tec, action!.id, { step: "VALIDAR", evidenceDocumentIds: [] }, meta())).rejects.toMatchObject({ status: 403 });
    await expect(advanceAction(await actorOf(gestorB), action!.id, { step: "VALIDAR", evidenceDocumentIds: [] }, meta())).rejects.toMatchObject({ status: 404 });
    const done = await advanceAction(await actorOf(tecnico2), action!.id, { step: "VALIDAR", note: "Conferido no local.", evidenceDocumentIds: [] }, meta());
    expect(done.status).toBe("ENCERRADA");
    const started = await transitionWork(ga, w.id, { action: "iniciar_execucao", version: w.version }, meta());
    expect(started.status).toBe("EM_EXECUCAO");
  });

  it("critério de criticidade é configurável e o incidente gera alerta", async () => {
    const adm = await actorOf(admin);
    await updateCriticality(adm, "MEDIA", { name: "Média", responseDays: 10, priorityAlert: true, blocksProgress: false }, meta());
    try {
      const w = await approvedWork();
      await createIncident(await actorOf(tecnico), { workId: w.id, type: "QUASE_ACIDENTE", occurredAt: new Date(Date.now() - 3600_000), description: "Material caiu próximo à passagem.", criticality: "MEDIA" } as never, meta());
      const a = await createAction(await actorOf(tecnico), { workId: w.id, title: "Isolar a passagem", criticality: "MEDIA", responsibleName: "Equipe fictícia" } as never, meta());
      const expected = new Date();
      expected.setUTCHours(0, 0, 0, 0);
      expect(a.dueDate.getTime() - expected.getTime()).toBe(10 * 86_400_000);
      await expect(updateCriticality(await actorOf(gestorA), "MEDIA", { name: "x", responseDays: 1, priorityAlert: false, blocksProgress: false }, meta())).rejects.toMatchObject({ status: 403 });
    } finally {
      await updateCriticality(adm, "MEDIA", { name: "Média", responseDays: 15, priorityAlert: false, blocksProgress: false }, meta());
    }
  });
});

describe("alertas", () => {
  it("gera alertas sem duplicar na segunda execução", async () => {
    const first = await generateAlerts();
    expect(first).toBeGreaterThan(0);
    const second = await generateAlerts();
    expect(second).toBe(0);
    const kinds = new Set((await prisma.notification.findMany({ select: { kind: true } })).map((n) => n.kind));
    expect(kinds.has("qualificacao.vencida")).toBe(true);
    expect(kinds.has("epi.estoque_baixo")).toBe(true);
  });
});
