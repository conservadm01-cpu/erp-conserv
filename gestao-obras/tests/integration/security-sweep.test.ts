/**
 * Varreduras de segurança sobre os Route Handlers reais:
 *  - CSRF: toda rota de alteração recusa requisições sem Origin da aplicação;
 *  - autenticação: toda rota não pública exige sessão;
 *  - IDOR: gestor de outra região não acessa recursos por identificador.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { createSession, sessionCookieName } from "@/server/auth/session";
import { MemoryStorage, setStorage } from "@/server/storage/storage";
import { createWork, createStage } from "@/server/services/work.service";
import { uploadDocument } from "@/server/services/document.service";
import { createPerson } from "@/server/services/people.service";
import { createCompany } from "@/server/services/company.service";
import { createEquipment } from "@/server/services/equipment.service";
import { createAction, createInspection } from "@/server/services/safety.service";
import { createBudget } from "@/server/services/budget.service";
import { actorOf, makeTree, makeUser, meta } from "./fixtures";

const API = path.resolve(__dirname, "../../src/app/api");
const PUBLIC = new Set(["/api/health", "/api/openapi", "/api/auth/login", "/api/auth/password/forgot", "/api/auth/password/reset"]);

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const full = path.join(dir, f);
    return statSync(full).isDirectory() ? routeFiles(full) : f === "route.ts" ? [full] : [];
  });
}

const routes = routeFiles(API).map((file) => {
  const rel = "/" + path.relative(path.resolve(API, ".."), path.dirname(file)).split(path.sep).join("/");
  const params = [...rel.matchAll(/\[(\w+)\]/g)].map((m) => m[1]!);
  return { file, rel, params };
});

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
const ZERO = "00000000-0000-4000-8000-000000000000";

async function call(file: string, method: string, url: string, params: Record<string, string>, headers: Record<string, string> = {}, body?: unknown) {
  const mod = (await import(file)) as Record<string, Handler | undefined>;
  const h = mod[method];
  if (!h) throw new Error(`sem ${method}`);
  const req = new NextRequest(new URL(url, "http://localhost:3000"), { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return h(req, { params: Promise.resolve(params) });
}

describe("varredura: proteção CSRF em todas as rotas de alteração", () => {
  it("recusa POST/PUT/PATCH/DELETE sem Origin ou com Origin de outro site", async () => {
    const failures: string[] = [];
    for (const r of routes) {
      const mod = await import(r.file);
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        if (!mod[method]) continue;
        const params = Object.fromEntries(r.params.map((p) => [p, ZERO]));
        const url = r.rel.replace(/\[(\w+)\]/g, ZERO);
        for (const origin of [undefined, "https://ataque.example"]) {
          const res = await call(r.file, method, url, params, origin ? { origin, host: "localhost:3000" } : { host: "localhost:3000" }, {});
          if (res.status !== 403) failures.push(`${method} ${r.rel} (${origin ?? "sem Origin"}) → ${res.status}`);
        }
      }
    }
    expect(failures).toEqual([]);
  }, 60_000);
});

describe("varredura: autenticação obrigatória", () => {
  it("rotas não públicas respondem 401 sem sessão", async () => {
    const failures: string[] = [];
    for (const r of routes) {
      if (PUBLIC.has(r.rel)) continue;
      const mod = await import(r.file);
      const params = Object.fromEntries(r.params.map((p) => [p, ZERO]));
      const url = r.rel.replace(/\[(\w+)\]/g, ZERO);
      for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
        if (!mod[method]) continue;
        const res = await call(r.file, method, url, params, { origin: "http://localhost:3000", host: "localhost:3000" }, method === "GET" ? undefined : {});
        if (res.status !== 401) failures.push(`${method} ${r.rel} → ${res.status}`);
      }
    }
    expect(failures).toEqual([]);
  }, 60_000);
});

describe("varredura: acesso indevido por identificador (IDOR) entre regiões", () => {
  let cookie: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    setStorage(new MemoryStorage());
    const t = await makeTree();
    const gestorB = await makeUser({ unit: t.regB, role: "GESTOR_REGIONAL" });
    const tecB = await makeUser({ unit: t.regB, role: "TECNICO_SEGURANCA" });
    const gestorA = await makeUser({ unit: t.regA, role: "GESTOR_REGIONAL" });
    const b = await actorOf(gestorB);
    const work = await createWork(b, { unitId: t.b1.id, title: "Obra da região B", typeCode: "REFORMA", activities: [], priority: "MEDIA", executionMode: "VOLUNTARIOS", scope: "s", justification: "j" } as never, meta());
    const stage = await createStage(b, work.id, { name: "Etapa B", sortOrder: 1, status: "NAO_INICIADA", progress: 0 } as never, meta());
    const doc = await uploadDocument(b, work.id, { categoryCode: "PROJETO", title: "Projeto B" } as never, { name: "b.pdf", bytes: new TextEncoder().encode("%PDF-1.4 b") }, meta());
    const version = await prisma.documentVersion.findFirstOrThrow({ where: { documentId: doc.id } });
    const person = await createPerson(b, { name: "Pessoa B", category: "VOLUNTARIO", unitId: t.b1.id } as never, meta());
    const company = await createCompany(b, { legalName: "Empresa B", cnpj: "45723174000110", unitId: t.regB.id } as never, meta()).catch(async () => prisma.company.findUniqueOrThrow({ where: { cnpj: "45723174000110" } }));
    const equipment = await createEquipment(b, { kind: "FERRAMENTA", name: "Ferramenta B", unitId: t.b1.id } as never, meta());
    const tec = await actorOf(tecB);
    const inspection = await createInspection(tec, { workId: work.id, title: "Inspeção B", plannedDate: new Date() } as never, meta());
    const action = await createAction(tec, { workId: work.id, title: "Ação B", criticality: "BAIXA", responsibleName: "Fulano" } as never, meta());
    const budget = await createBudget(b, work.id, { reason: "Orçamento B", copyFromApproved: true }, meta());
    Object.assign(ids, { work: work.id, stage: stage.id, doc: doc.id, version: version.id, person: person.id, company: company.id, equipment: equipment.id, inspection: inspection.id, action: action.id, budget: budget.id, unit: t.b1.id, user: gestorB.id });
    const { token } = await createSession(gestorA.id, meta());
    await prisma.session.updateMany({ where: { userId: gestorA.id }, data: { mfaVerifiedAt: new Date() } });
    await prisma.user.update({ where: { id: gestorA.id }, data: { mfaEnabledAt: new Date() } });
    cookie = `${sessionCookieName()}=${token}`;
  });

  const targets: [string, string, string, (i: Record<string, string>) => Record<string, string>, unknown?][] = [
    ["GET", "works/[id]", "/api/works/:work", (i) => ({ id: i.work! })],
    ["PATCH", "works/[id]", "/api/works/:work", (i) => ({ id: i.work! }), { version: 1, title: "x" }],
    ["GET", "works/[id]/schedule", "/api/works/:work/schedule", (i) => ({ id: i.work! })],
    ["GET", "works/[id]/budget", "/api/works/:work/budget", (i) => ({ id: i.work! })],
    ["GET", "works/[id]/safety", "/api/works/:work/safety", (i) => ({ id: i.work! })],
    ["GET", "works/[id]/team", "/api/works/:work/team", (i) => ({ id: i.work! })],
    ["GET", "works/[id]/documents", "/api/works/:work/documents", (i) => ({ id: i.work! })],
    ["GET", "works/[id]/requirements", "/api/works/:work/requirements", (i) => ({ id: i.work! })],
    ["GET", "works/[id]/diary", "/api/works/:work/diary", (i) => ({ id: i.work! })],
    ["GET", "works/[id]/reports/dossie", "/api/works/:work/reports/dossie", (i) => ({ id: i.work! })],
    ["POST", "works/[id]/transitions", "/api/works/:work/transitions", (i) => ({ id: i.work! }), { action: "solicitar", version: 1 }],
    ["PATCH", "works/[id]/stages/[stageId]", "/api/works/:work/stages/:stage", (i) => ({ id: i.work!, stageId: i.stage! }), { name: "x", progress: 10 }],
    ["POST", "works/[id]/budgets/[budgetId]/lines", "/api/works/:work/budgets/:budget/lines", (i) => ({ id: i.work!, budgetId: i.budget! }), { category: "MATERIAIS", description: "x", unit: "un", quantity: 1, unitPrice: 1 }],
    ["POST", "documents/[id]/versions/[versionId]/download", "/api/documents/:doc/versions/:version/download", (i) => ({ id: i.doc!, versionId: i.version! })],
    ["POST", "documents/[id]/review", "/api/documents/:doc/review", (i) => ({ id: i.doc! }), { decision: "APROVAR" }],
    ["GET", "people/[id]", "/api/people/:person", (i) => ({ id: i.person! })],
    ["GET", "companies/[id]", "/api/companies/:company", (i) => ({ id: i.company! })],
    ["GET", "equipment/[id]", "/api/equipment/:equipment", (i) => ({ id: i.equipment! })],
    ["GET", "safety/inspections/[id]", "/api/safety/inspections/:inspection", (i) => ({ id: i.inspection! })],
    ["GET", "safety/inspections/[id]/report", "/api/safety/inspections/:inspection/report", (i) => ({ id: i.inspection! })],
    ["GET", "safety/actions/[id]", "/api/safety/actions/:action", (i) => ({ id: i.action! })],
    ["POST", "safety/actions/[id]", "/api/safety/actions/:action", (i) => ({ id: i.action! }), { step: "INICIAR", evidenceDocumentIds: [] }],
    ["GET", "org-units/[id]", "/api/org-units/:unit", (i) => ({ id: i.unit! })],
    ["GET", "users/[id]", "/api/users/:user", (i) => ({ id: i.user! })],
    ["GET", "reports/[type]", "/api/reports/resumo-executivo?workId=:work", () => ({ type: "resumo-executivo" })],
  ];

  it("responde 403/404 para todos os recursos da outra região", async () => {
    const failures: string[] = [];
    for (const [method, rel, urlTpl, params, body] of targets) {
      const url = urlTpl.replace(/:(\w+)/g, (_, k) => ids[k]!);
      const res = await call(path.join(API, rel, "route.ts"), method, url, params(ids), { cookie, origin: "http://localhost:3000", host: "localhost:3000" }, body);
      if (![403, 404].includes(res.status)) failures.push(`${method} ${url} → ${res.status}`);
    }
    expect(failures).toEqual([]);
  }, 60_000);

  it("listagens não incluem recursos da outra região", async () => {
    const lists: [string, string, string][] = [["works", "/api/works", "works"], ["documents", "/api/documents", "documents"], ["people", "/api/people", "people"], ["companies", "/api/companies", "companies"], ["equipment", "/api/equipment", "equipment"], ["safety/actions", "/api/safety/actions", "actions"], ["safety/inspections", "/api/safety/inspections", "inspections"]];
    for (const [rel, url, key] of lists) {
      const res = await call(path.join(API, rel, "route.ts"), "GET", url, {}, { cookie });
      expect(res.status, url).toBe(200);
      const body = JSON.stringify((await res.json())[key]);
      for (const v of Object.values(ids)) expect(body.includes(v), `${url} contém ${v}`).toBe(false);
    }
  }, 60_000);
});
