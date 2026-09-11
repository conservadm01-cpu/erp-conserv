// =====================================================================
// INTEGRIDADE DO CONTEÚDO — Academia ConServ
// ---------------------------------------------------------------------
// Percorre TODO o catálogo procurando referência quebrada: SOURCE_ID que
// não resolve, curso sem aula, quiz com questão inexistente, jogo com
// resposta correta fora das opções, cena com ponto fora da área, badge
// apontando para competência que não existe, matrícula sem curso...
//
// É a rede de segurança de quem alimenta a plataforma: se alguém apagar
// um material que sustenta uma questão, este teste acusa.
//
//   npm run test:academia
// =====================================================================
import { runSeed } from "../data/seed/index";
import { db } from "../data/db";
import { parseSourceId } from "../core/ids";
import { COLLECTIONS } from "../data/schema";

const problems: string[] = [];
const warn: string[] = [];
function bad(msg: string) { problems.push(msg); }
function soft(msg: string) { warn.push(msg); }

await runSeed();

const has = (c: any, id: string | undefined) => !!id && !!db.byId(c, id);

const contents = db.list("content");
const courses = db.list("courses");
const modules = db.list("modules");
const lessons = db.list("lessons");
const questions = db.list("questions");
const quizzes = db.list("quizzes");
const games = db.list("games");
const challenges = db.list("challenges");
const curiosities = db.list("curiosities");
const paths = db.list("learning_paths");
const badges = db.list("badges");
const employees = db.list("employees");
const users = db.list("users");
const roles = db.list("job_roles");
const competencies = db.list("competencies");
const certificates = db.list("certificates");
const handbooks = db.list("handbooks");
const enrollments = db.list("enrollments");
const progress = db.list("progress");
const attempts = db.list("quiz_attempts");
const empComps = db.list("employee_competencies");
const empBadges = db.list("employee_badges");
const xp = db.list("xp_transactions");
const risks = db.list("risk_reports");

// ---------- SOURCE_ID resolve? ----------
function checkSource(label: string, sourceId?: string) {
  if (!sourceId) { bad(`${label}: sem SOURCE_ID`); return; }
  const parsed = parseSourceId(sourceId);
  if (!parsed) { bad(`${label}: SOURCE_ID mal formado (${sourceId})`); return; }
  const content = db.byId("content", parsed.contentId);
  if (!content) { bad(`${label}: material ${parsed.contentId} não existe`); return; }
  if (!content.chunks[parsed.chunkIndex]) bad(`${label}: trecho ${parsed.chunkIndex} não existe em ${parsed.contentId} (tem ${content.chunks.length})`);
}

for (const q of questions) checkSource(`questão ${q.id}`, q.sourceRef?.sourceId);
for (const c of curiosities) checkSource(`curiosidade ${c.id}`, c.sourceRef?.sourceId);
for (const c of challenges) checkSource(`desafio ${c.id}`, c.sourceRef?.sourceId);
for (const g of games) for (const r of g.sourceRefs) checkSource(`jogo ${g.id}`, r.sourceId);
for (const l of lessons) {
  for (const r of l.sourceRefs) checkSource(`aula ${l.id}`, r.sourceId);
  for (const b of l.blocks) if ("sourceId" in b && b.sourceId) checkSource(`aula ${l.id} (bloco)`, b.sourceId);
}
// SOURCE_IDs dentro dos jogos
for (const g of games) {
  const p = g.payload;
  if (p.kind === "diagnosis") for (const r of p.rounds) if (r.sourceId) checkSource(`jogo ${g.id} rodada ${r.id}`, r.sourceId);
  if (p.kind === "sequence") for (const r of p.rounds) if (r.sourceId) checkSource(`jogo ${g.id} rodada ${r.id}`, r.sourceId);
  if (p.kind === "hotspot") for (const r of p.rounds) for (const s of r.spots) if (s.sourceId) checkSource(`jogo ${g.id} ponto ${s.id}`, s.sourceId);
}

// ---------- referências de catálogo ----------
for (const course of courses) {
  for (const m of course.moduleIds) if (!has("modules", m)) bad(`curso ${course.id}: módulo ${m} não existe`);
  if (course.finalQuizId && !has("quizzes", course.finalQuizId)) bad(`curso ${course.id}: quiz final ${course.finalQuizId} não existe`);
  for (const c of course.competencies) if (!has("competencies", c)) bad(`curso ${course.id}: competência ${c} não existe`);
  for (const s of course.librarySourceIds) if (!has("content_sources", s)) bad(`curso ${course.id}: fonte ${s} não existe`);
  for (const c of course.sourceContentIds) if (!has("content", c)) bad(`curso ${course.id}: material ${c} não existe`);
  if (course.handbookId && !has("handbooks", course.handbookId)) bad(`curso ${course.id}: apostila ${course.handbookId} não existe`);
  const courseLessons = lessons.filter((l) => l.courseId === course.id);
  if (courseLessons.length === 0) bad(`curso ${course.id}: sem aulas`);
  if (course.status === "published" && !course.finalQuizId) soft(`curso ${course.id} publicado sem avaliação final`);
}
for (const m of modules) {
  if (!has("courses", m.courseId)) bad(`módulo ${m.id}: curso ${m.courseId} não existe`);
  for (const l of m.lessonIds) if (!has("lessons", l)) bad(`módulo ${m.id}: aula ${l} não existe`);
  if (m.lessonIds.length === 0) bad(`módulo ${m.id}: sem aulas`);
}
for (const l of lessons) {
  if (!has("courses", l.courseId)) bad(`aula ${l.id}: curso não existe`);
  if (!has("modules", l.moduleId)) bad(`aula ${l.id}: módulo ${l.moduleId} não existe`);
  const mod = db.byId("modules", l.moduleId);
  if (mod && !mod.lessonIds.includes(l.id)) bad(`aula ${l.id}: não está listada no módulo ${l.moduleId}`);
  for (const c of l.competencies) if (!has("competencies", c)) bad(`aula ${l.id}: competência ${c} não existe`);
  if (l.blocks.length === 0) bad(`aula ${l.id}: sem conteúdo`);
}
for (const q of questions) {
  if (q.courseId && !has("courses", q.courseId)) bad(`questão ${q.id}: curso ${q.courseId} não existe`);
  if (q.contentId && !has("content", q.contentId)) bad(`questão ${q.id}: material ${q.contentId} não existe`);
  for (const c of q.competencies) if (!has("competencies", c)) bad(`questão ${q.id}: competência ${c} não existe`);
  if (!q.options.some((o) => o.id === q.correctOptionId)) bad(`questão ${q.id}: resposta correta não está entre as alternativas`);
  if (q.options.length !== 4) soft(`questão ${q.id}: ${q.options.length} alternativas (padrão são 4)`);
  if (new Set(q.options.map((o) => o.text.trim().toLowerCase())).size !== q.options.length) bad(`questão ${q.id}: alternativas repetidas`);
  if (!q.explanation?.trim()) bad(`questão ${q.id}: sem explicação`);
}
for (const quiz of quizzes) {
  if (quiz.questionIds.length === 0) bad(`quiz ${quiz.id}: sem questões`);
  for (const qid of quiz.questionIds) if (!has("questions", qid)) bad(`quiz ${quiz.id}: questão ${qid} não existe`);
  const approved = quiz.questionIds.filter((qid) => db.byId("questions", qid)?.status === "approved");
  if (approved.length < quiz.drawCount) bad(`quiz ${quiz.id}: sorteia ${quiz.drawCount} mas só ${approved.length} questões aprovadas`);
  if (quiz.scope === "avaliacao_final" && quiz.refId && !has("courses", quiz.refId)) bad(`quiz ${quiz.id}: curso ${quiz.refId} não existe`);
  if (quiz.scope === "aula" && quiz.refId && !has("lessons", quiz.refId)) bad(`quiz ${quiz.id}: aula ${quiz.refId} não existe`);
}
for (const g of games) {
  for (const c of g.competencies) if (!has("competencies", c)) bad(`jogo ${g.id}: competência ${c} não existe`);
  if (g.courseId && !has("courses", g.courseId)) bad(`jogo ${g.id}: curso ${g.courseId} não existe`);
  const p = g.payload;
  if (p.kind === "diagnosis") {
    for (const r of p.rounds) {
      if (!r.options.some((o) => o.id === r.correctOptionId)) bad(`jogo ${g.id} rodada ${r.id}: resposta correta inexistente`);
      if (r.options.length < 2) bad(`jogo ${g.id} rodada ${r.id}: menos de 2 opções`);
    }
  }
  if (p.kind === "sequence") {
    for (const r of p.rounds) {
      const orders = r.items.map((i) => i.correctOrder).sort((a, b) => a - b);
      const esperado = r.items.map((_, i) => i + 1);
      if (JSON.stringify(orders) !== JSON.stringify(esperado)) bad(`jogo ${g.id} rodada ${r.id}: ordem correta inválida (${orders.join(",")})`);
    }
  }
  if (p.kind === "hotspot") {
    for (const r of p.rounds) {
      const alvos = r.spots.filter((s) => s.isTarget).length;
      if (alvos !== r.targetsToFind) bad(`jogo ${g.id} cena ${r.id}: targetsToFind=${r.targetsToFind} mas há ${alvos} alvos`);
      for (const s of r.spots) {
        if (s.x < 0 || s.y < 0 || s.x + s.w > 100 || s.y + s.h > 100) bad(`jogo ${g.id} ponto ${s.id}: fora da cena (${s.x},${s.y},${s.w},${s.h})`);
      }
      // sobreposição de pontos deixa a área ambígua
      for (let i = 0; i < r.spots.length; i++) for (let j = i + 1; j < r.spots.length; j++) {
        const a = r.spots[i], b = r.spots[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        if (overlap) soft(`jogo ${g.id} cena ${r.id}: pontos ${a.id} e ${b.id} se sobrepõem`);
      }
    }
  }
  if (p.kind === "timed_quiz") {
    for (const r of p.rounds) {
      const total = r.questionIds.length + (r.inlineQuestions?.length ?? 0);
      if (total === 0) bad(`jogo ${g.id}: rodada sem perguntas`);
      for (const qid of r.questionIds) if (!has("questions", qid)) bad(`jogo ${g.id}: questão ${qid} não existe`);
      for (const iq of r.inlineQuestions ?? []) if (iq.correctIndex < 0 || iq.correctIndex >= iq.options.length) bad(`jogo ${g.id}: correctIndex inválido`);
    }
  }
}
for (const c of challenges) {
  if (!c.options.some((o) => o.id === c.correctOptionId)) bad(`desafio ${c.id}: resposta correta inexistente`);
  if (c.courseId && !has("courses", c.courseId)) bad(`desafio ${c.id}: curso ${c.courseId} não existe`);
  for (const comp of c.competencies) if (!has("competencies", comp)) bad(`desafio ${c.id}: competência ${comp} não existe`);
}
for (const c of curiosities) for (const comp of c.competencies) if (!has("competencies", comp)) bad(`curiosidade ${c.id}: competência ${comp} não existe`);
for (const p of paths) {
  for (const cid of p.courseIds) if (!has("courses", cid)) bad(`trilha ${p.id}: curso ${cid} não existe`);
  for (const comp of p.competencies) if (!has("competencies", comp)) bad(`trilha ${p.id}: competência ${comp} não existe`);
}
for (const b of badges) {
  const rule: any = b.rule;
  if (rule.kind === "competency_level" && !has("competencies", rule.competencyId)) bad(`badge ${b.id}: competência ${rule.competencyId} não existe`);
  if (rule.kind === "path_completed" && rule.pathId && !has("learning_paths", rule.pathId)) bad(`badge ${b.id}: trilha ${rule.pathId} não existe`);
  if (rule.kind === "games_passed" && rule.gameType && !games.some((g) => g.type === rule.gameType)) bad(`badge ${b.id}: nenhum jogo do tipo ${rule.gameType}`);
}
for (const content of contents) {
  for (const s of content.librarySourceIds) if (!has("content_sources", s)) bad(`material ${content.id}: fonte ${s} não existe`);
  for (const c of content.competencies) if (!has("competencies", c)) bad(`material ${content.id}: competência ${c} não existe`);
  if (!has("employees", content.createdBy)) bad(`material ${content.id}: autor ${content.createdBy} não existe`);
  content.chunks.forEach((chunk, i) => {
    if (chunk.index !== i) bad(`material ${content.id}: índice do trecho fora de ordem`);
    if (!chunk.sourceId.endsWith(`#${i}`)) bad(`material ${content.id}: SOURCE_ID do trecho ${i} inconsistente`);
  });
}

// ---------- pessoas ----------
for (const e of employees) {
  if (!has("departments", e.departmentId)) bad(`colaborador ${e.id}: setor não existe`);
  if (!has("job_roles", e.jobRoleId)) bad(`colaborador ${e.id}: função não existe`);
  if (e.supervisorId && !has("employees", e.supervisorId)) bad(`colaborador ${e.id}: supervisor não existe`);
}
for (const u of users) if (!has("employees", u.employeeId)) bad(`usuário ${u.login}: colaborador não existe`);
if (new Set(users.map((u) => u.login)).size !== users.length) bad("logins de usuário repetidos");
if (new Set(employees.map((e) => e.code)).size !== employees.length) bad("matrículas repetidas");
for (const r of roles) {
  if (!has("departments", r.departmentId)) bad(`função ${r.id}: setor não existe`);
  for (const t of r.targets) {
    if (!has("competencies", t.competencyId)) bad(`função ${r.id}: competência alvo ${t.competencyId} não existe`);
    if (t.level < 1 || t.level > 6) bad(`função ${r.id}: nível alvo inválido`);
  }
}

// ---------- demonstração ----------
for (const en of enrollments) {
  if (!has("employees", en.employeeId)) bad(`matrícula ${en.id}: colaborador não existe`);
  if (!has("courses", en.courseId)) bad(`matrícula ${en.id}: curso não existe`);
  if (en.certificateId && !has("certificates", en.certificateId)) bad(`matrícula ${en.id}: certificado ${en.certificateId} não existe`);
  const total = lessons.filter((l) => l.courseId === en.courseId).length;
  if (en.lessonsTotal !== total) soft(`matrícula ${en.id}: lessonsTotal=${en.lessonsTotal} mas o curso tem ${total} aulas`);
  const done = progress.filter((p) => p.employeeId === en.employeeId && p.courseId === en.courseId && p.status === "concluido").length;
  if (en.lessonsDone !== done) soft(`matrícula ${en.id}: lessonsDone=${en.lessonsDone} mas há ${done} aulas concluídas`);
}
for (const p of progress) {
  if (!has("lessons", p.lessonId)) bad(`progresso ${p.id}: aula ${p.lessonId} não existe`);
  if (!has("employees", p.employeeId)) bad(`progresso ${p.id}: colaborador não existe`);
  const lesson = db.byId("lessons", p.lessonId);
  if (lesson && lesson.courseId !== p.courseId) bad(`progresso ${p.id}: curso não bate com a aula`);
}
for (const a of attempts) {
  if (!has("quizzes", a.quizId)) bad(`tentativa ${a.id}: quiz ${a.quizId} não existe`);
  for (const ans of a.answers) if (!has("questions", ans.questionId)) bad(`tentativa ${a.id}: questão ${ans.questionId} não existe`);
}
for (const ec of empComps) {
  if (!has("competencies", ec.competencyId)) bad(`competência do colaborador ${ec.id}: ${ec.competencyId} não existe`);
  if (!has("employees", ec.employeeId)) bad(`competência do colaborador ${ec.id}: colaborador não existe`);
  if (ec.level < 1 || ec.level > 6) bad(`competência do colaborador ${ec.id}: nível ${ec.level} inválido`);
}
for (const eb of empBadges) {
  if (!has("badges", eb.badgeId)) bad(`badge conquistado ${eb.id}: badge ${eb.badgeId} não existe`);
  if (!has("employees", eb.employeeId)) bad(`badge conquistado ${eb.id}: colaborador não existe`);
}
for (const t of xp) if (!has("employees", t.employeeId)) bad(`XP ${t.id}: colaborador não existe`);
for (const cert of certificates) {
  if (!has("employees", cert.employeeId)) bad(`certificado ${cert.code}: colaborador não existe`);
  if (cert.kind === "curso" && !has("courses", cert.refId)) bad(`certificado ${cert.code}: curso ${cert.refId} não existe`);
  if (cert.validationPath !== `/validar-certificado/${cert.code}`) bad(`certificado ${cert.code}: caminho de validação inconsistente`);
  for (const c of cert.competencies) if (!has("competencies", c)) bad(`certificado ${cert.code}: competência ${c} não existe`);
}
if (new Set(certificates.map((c) => c.code)).size !== certificates.length) bad("códigos de certificado repetidos");
for (const h of handbooks) {
  if (h.courseId && !has("courses", h.courseId)) bad(`apostila ${h.id}: curso não existe`);
  for (const cid of h.contentIds) if (!has("content", cid)) bad(`apostila ${h.id}: material ${cid} não existe`);
  if (h.sections.length === 0) bad(`apostila ${h.id}: sem seções`);
}
for (const r of risks) {
  if (r.employeeId && !has("employees", r.employeeId)) bad(`risco ${r.code}: colaborador não existe`);
  if (r.anonymous && r.employeeName) bad(`risco ${r.code}: registro anônimo com nome preenchido`);
  if (r.timeline.length === 0) bad(`risco ${r.code}: sem histórico`);
}

// ---------- ids duplicados por coleção ----------
for (const col of COLLECTIONS) {
  const list = db.list(col as any) as Array<{ id: string }>;
  if (new Set(list.map((x) => x.id)).size !== list.length) bad(`coleção ${col}: ids repetidos`);
}

// fontes órfãs (cadastradas mas não vinculadas a nenhum material)
const fontesUsadas = new Set(contents.flatMap((c) => c.librarySourceIds));
const orfaosFonte = db.list("content_sources").filter((f) => !fontesUsadas.has(f.id));
if (orfaosFonte.length) soft(`${orfaosFonte.length} fonte(s) cadastradas sem material vinculado: ${orfaosFonte.map((f) => f.name).slice(0, 3).join("; ")}`);

// ---------- cobertura ----------
const semCurso = paths.filter((p) => p.courseIds.length === 0).length;
soft(`${semCurso} trilhas ainda sem curso (aparecem como "em construção")`);
const orfas = questions.filter((q) => !quizzes.some((z) => z.questionIds.includes(q.id))).length;
soft(`${orfas} questões aprovadas não estão em nenhum quiz`);
const semJogo = competencies.filter((c) => !games.some((g) => g.competencies.includes(c.id))).length;
soft(`${semJogo} competências sem jogo associado`);

console.log("escopo verificado:", JSON.stringify({
  materiais: contents.length, trechos: contents.reduce((n, c) => n + c.chunks.length, 0),
  cursos: courses.length, modulos: modules.length, aulas: lessons.length,
  blocos: lessons.reduce((n, l) => n + l.blocks.length, 0),
  questoes: questions.length, quizzes: quizzes.length, jogos: games.length,
  rodadas: games.reduce((n, g) => n + (g.payload as any).rounds.length, 0),
  desafios: challenges.length, curiosidades: curiosities.length, trilhas: paths.length,
  badges: badges.length, colaboradores: employees.length, certificados: certificates.length,
  apostilas: handbooks.length, secoes: handbooks.reduce((n, h) => n + h.sections.length, 0),
  matriculas: enrollments.length, progresso: progress.length, tentativas: attempts.length,
}));
console.log("PROBLEMAS:", problems.length);
for (const p of problems) console.log("  ✗", p);
console.log("\nOBSERVAÇÕES:", warn.length);
for (const w of warn) console.log("  ·", w);
process.exit(problems.length > 0 ? 1 : 0);
