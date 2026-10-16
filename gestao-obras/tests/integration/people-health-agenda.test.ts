import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { MemoryStorage, setStorage } from "@/server/storage/storage";
import { addAssignment, createPerson, getPerson, listPeople } from "@/server/services/people.service";
import { addCredential } from "@/server/services/people.service";
import {
  addHealthCertificate, getMyProfile, linkPersonUser, listHealthCertificates, reviewHealthCertificate, updatePersonRule, uploadMyCredential, uploadMyHealthCertificate,
} from "@/server/services/health.service";
import { listOwnerDocuments, requestDownload, searchDocuments, uploadOwnedDocument } from "@/server/services/document.service";
import { createAgendaEvent, listAgenda, myAgenda, setAgendaEventStatus } from "@/server/services/agenda.service";
import { createWork } from "@/server/services/work.service";
import { agendaEventSchema, agendaStatusSchema } from "@/server/validation/agenda";
import { healthCertificateSchema } from "@/server/validation/health";
import { actorOf, makeTree, makeUser, meta } from "./fixtures";

const PDF = new TextEncoder().encode("%PDF-1.4\n%%EOF");
let t: Awaited<ReturnType<typeof makeTree>>;
let admin: Awaited<ReturnType<typeof makeUser>>;
let gestorA: Awaited<ReturnType<typeof makeUser>>;
let gestorB: Awaited<ReturnType<typeof makeUser>>;
let tecnicoA: Awaited<ReturnType<typeof makeUser>>;
let tecnicoA2: Awaited<ReturnType<typeof makeUser>>;
let volUser: Awaited<ReturnType<typeof makeUser>>;
let otherVolUser: Awaited<ReturnType<typeof makeUser>>;

const aso = (over: Record<string, unknown> = {}) => healthCertificateSchema.parse({ examType: "PERIODICO", result: "APTO", fitFor: "TRABALHO_ALTURA", examDate: "2026-01-10", expiryDate: "2099-01-10", ...over });

beforeAll(async () => {
  setStorage(new MemoryStorage());
  t = await makeTree();
  admin = await makeUser({ unit: t.root, role: "ADMIN_SISTEMA" });
  gestorA = await makeUser({ unit: t.regA, role: "GESTOR_REGIONAL" });
  gestorB = await makeUser({ unit: t.regB, role: "GESTOR_REGIONAL" });
  tecnicoA = await makeUser({ unit: t.regA, role: "TECNICO_SEGURANCA" });
  tecnicoA2 = await makeUser({ unit: t.regA, role: "TECNICO_SEGURANCA" });
  volUser = await makeUser({ unit: t.a1, role: "VOLUNTARIO" });
  otherVolUser = await makeUser({ unit: t.a1, role: "VOLUNTARIO" });
});

async function volunteer(name = "Voluntário Teste") {
  return createPerson(await actorOf(gestorA), { name, category: "VOLUNTARIO", unitId: t.a1.id, authorizedActivities: ["TRABALHO_ALTURA"] } as never, meta());
}

describe("ASO: dado sensível com acesso restrito", () => {
  it("técnico registra e confere; gestor não vê ASO nem o arquivo; outra região não acessa", async () => {
    const p = await volunteer();
    const h = await addHealthCertificate(await actorOf(tecnicoA), p.id, aso(), { name: "aso.pdf", bytes: PDF }, meta());
    expect(h.status).toBe("PENDENTE_CONFERENCIA");
    await reviewHealthCertificate(await actorOf(tecnicoA2), p.id, h.id, "CONFERIR", meta());

    expect(await listHealthCertificates(await actorOf(gestorA), p.id)).toBeNull();
    expect((await listHealthCertificates(await actorOf(tecnicoA), p.id))!.length).toBe(1);
    // O documento do ASO não aparece para quem não tem permissão de saúde.
    expect((await listOwnerDocuments(await actorOf(gestorA), "person", p.id, p.unitPath)).some((d) => d.sensitive)).toBe(false);
    expect((await searchDocuments(await actorOf(gestorA), {})).some((d) => d.id === h.documentId)).toBe(false);
    const version = await prisma.documentVersion.findFirstOrThrow({ where: { documentId: h.documentId! } });
    await expect(requestDownload(await actorOf(gestorA), h.documentId!, version.id, meta())).rejects.toMatchObject({ status: 404 });
    await expect(requestDownload(await actorOf(tecnicoA), h.documentId!, version.id, meta())).resolves.toHaveProperty("url");
    // Gestor não envia documento na categoria restrita pelo cadastro comum.
    await expect(uploadOwnedDocument(await actorOf(gestorA), { kind: "person", id: p.id }, { categoryCode: "ASO", title: "x" } as never, { name: "a.pdf", bytes: PDF }, meta())).rejects.toMatchObject({ status: 403 });
    // Outra região: a pessoa nem existe.
    await expect(getPerson(await actorOf(gestorB), p.id)).rejects.toMatchObject({ status: 404 });
    await expect(addHealthCertificate(await actorOf(gestorB), p.id, aso(), null, meta())).rejects.toMatchObject({ status: 404 });
    // A auditoria não guarda o título nem dados do exame.
    const ev = await prisma.auditEvent.findFirstOrThrow({ where: { objectId: h.documentId!, action: "documento.enviado" } });
    expect(JSON.stringify(ev.metadata)).toContain("(documento restrito)");
  });

  it("inapto não libera atividades", () => {
    expect(() => aso({ result: "INAPTO" })).toThrow();
  });
});

describe("exigências por atividade", () => {
  it("pendentes só avisam; validadas e bloqueantes impedem o vínculo até serem atendidas", async () => {
    const a = await actorOf(gestorA);
    const p = await volunteer("Voluntário Exigências");
    const w = await createWork(a, { unitId: t.a1.id, title: "Obra exigências", typeCode: "REFORMA", activities: ["TRABALHO_ALTURA"], priority: "MEDIA", executionMode: "VOLUNTARIOS", scope: "Escopo.", justification: "Justificativa." } as never, meta());
    const assign = () => addAssignment(a, p.id, { workId: w.id, role: "Ajudante", activities: ["TRABALHO_ALTURA"], startDate: new Date() } as never, meta());

    const r1 = await assign();
    expect(r1.warnings.some((x) => x.includes("pendente de validação"))).toBe(true);

    const rules = await prisma.personRequirementRule.findMany({ where: { activityCode: "TRABALHO_ALTURA" } });
    await expect(updatePersonRule(a, rules[0]!.id, { action: "validar", legalBasis: "x", lastReviewedAt: new Date(), blocking: true, sourceUrl: null } as never, meta())).rejects.toMatchObject({ status: 403 });
    for (const r of rules) await updatePersonRule(await actorOf(admin), r.id, { action: "validar", legalBasis: "Base registrada no teste", lastReviewedAt: new Date(), blocking: true, sourceUrl: null } as never, meta());
    await expect(assign()).rejects.toMatchObject({ status: 409 });

    await addCredential(a, p.id, { kind: "TREINAMENTO", name: "NR-35 Trabalho em altura", expiryDate: new Date("2099-01-01") } as never, meta());
    await addHealthCertificate(await actorOf(tecnicoA), p.id, { ...aso(), checked: true }, null, meta());
    const ok = await assign();
    expect(ok.warnings.filter((x) => x.includes("Trabalho em altura:"))).toEqual([]);

    for (const r of rules) await updatePersonRule(await actorOf(admin), r.id, { action: "reativar" } as never, meta());
  });
});

describe("portal do titular", () => {
  it("o voluntário vê e envia só o que é seu; não lista outras pessoas", async () => {
    const p = await volunteer("Voluntário Portal");
    await expect(linkPersonUser(await actorOf(gestorB), p.id, "", meta())).rejects.toMatchObject({ status: 404 });
    await linkPersonUser(await actorOf(gestorA), p.id, volUser.email, meta());
    const other = await volunteer("Outro voluntário");
    await expect(linkPersonUser(await actorOf(gestorA), other.id, volUser.email, meta())).rejects.toMatchObject({ status: 409 });

    const me = await actorOf(volUser);
    const profile = await getMyProfile(me);
    expect(profile.person.id).toBe(p.id);
    expect(await listPeople(me)).toEqual([]);
    await expect(getPerson(me, other.id)).rejects.toMatchObject({ status: 404 });

    const c = await uploadMyCredential(me, { kind: "TREINAMENTO", name: "NR-35 enviado pelo titular", issueDate: null, expiryDate: new Date("2099-01-01") } as never, { name: "c.pdf", bytes: PDF }, meta());
    expect(c.verifiedAt).toBeNull();
    const h = await uploadMyHealthCertificate(me, aso(), { name: "aso.pdf", bytes: PDF }, meta());
    expect(h.status).toBe("PENDENTE_CONFERENCIA");
    // O titular baixa o próprio ASO; outro voluntário não.
    const v = await prisma.documentVersion.findFirstOrThrow({ where: { documentId: h.documentId! } });
    await expect(requestDownload(me, h.documentId!, v.id, meta())).resolves.toHaveProperty("url");
    await expect(requestDownload(await actorOf(otherVolUser), h.documentId!, v.id, meta())).rejects.toMatchObject({ status: 404 });
    await expect(getMyProfile(await actorOf(otherVolUser))).rejects.toMatchObject({ status: 404 });
  });
});

describe("agenda por unidade local", () => {
  it("agenda na unidade, isola regiões, exige motivo para cancelar e aparece no portal", async () => {
    const a = await actorOf(gestorA);
    const ev = (over: Record<string, unknown> = {}) => agendaEventSchema.parse({ unitId: t.a1.id, kind: "MUTIRAO", title: "Mutirão de limpeza", date: "2099-03-10", startTime: "08:00", endTime: "12:00", slots: "15", ...over });
    const e = await createAgendaEvent(a, ev(), meta());
    expect(e.startsAt.toISOString()).toBe("2099-03-10T11:00:00.000Z");

    const range = { from: new Date("2099-03-01T03:00:00Z"), to: new Date("2099-04-01T03:00:00Z") };
    expect((await listAgenda(a, range)).some((i) => i.id === e.id)).toBe(true);
    expect((await listAgenda(await actorOf(gestorB), range)).some((i) => i.id === e.id)).toBe(false);
    expect((await listAgenda(a, { ...range, unitId: t.a2.id })).some((i) => i.id === e.id)).toBe(false);
    await expect(createAgendaEvent(await actorOf(gestorB), ev(), meta())).rejects.toMatchObject({ status: 404 });
    await expect(setAgendaEventStatus(await actorOf(gestorB), e.id, agendaStatusSchema.parse({ status: "REALIZADO" }), meta())).rejects.toMatchObject({ status: 404 });

    const wB = await createWork(await actorOf(gestorB), { unitId: t.b1.id, title: "Obra B", typeCode: "REFORMA", activities: [], priority: "MEDIA", executionMode: "VOLUNTARIOS", scope: "Escopo.", justification: "Justificativa." } as never, meta());
    await expect(createAgendaEvent(a, ev({ workId: wB.id }), meta())).rejects.toMatchObject({ status: 422 });
    expect(() => ev({ endTime: "07:00" })).toThrow();
    expect(() => agendaStatusSchema.parse({ status: "CANCELADO" })).toThrow();

    const p = await prisma.person.findFirstOrThrow({ where: { userId: volUser.id } });
    expect((await myAgenda(p.id, p.unitId)).some((x) => x.id === e.id)).toBe(true);

    await setAgendaEventStatus(a, e.id, agendaStatusSchema.parse({ status: "CANCELADO", reason: "Chuva prevista" }), meta());
    await expect(setAgendaEventStatus(a, e.id, agendaStatusSchema.parse({ status: "REALIZADO" }), meta())).rejects.toMatchObject({ status: 409 });
  });
});
