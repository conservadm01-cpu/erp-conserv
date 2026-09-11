// =====================================================================
// TESTE DE INTEGRAÇÃO DOS MOTORES — Academia ConServ
// ---------------------------------------------------------------------
// Roda sem navegador e sem banco: o `db` cai no adaptador de memória.
// Percorre o caminho completo do sistema:
//   carga inicial → curso → avaliação → certificado → validação pública
//   competências → gamificação → adaptativo → jogos → aprender no posto
//   upload de conteúdo → análise → aprovação → curso → apostila → versão
//
//   npm run test:academia
// =====================================================================
import { isSeeded, runSeed } from "../data/seed/index";
import { db } from "../data/db";
import { catalogRepo, certificateRepo, learningRepo, gamificationRepo, settingsRepo } from "../data/repositories/index";
import { progressEngine } from "../engines/learning/ProgressEngine";
import { quizEngine } from "../engines/quiz/QuizEngine";
import { certificateEngine } from "../engines/certificate/CertificateEngine";
import { competencyEngine } from "../engines/competency/CompetencyEngine";
import { adaptiveEngine } from "../engines/learning/AdaptiveEngine";
import { gameEngine } from "../engines/game/GameEngine";
import { contentEngine } from "../engines/content/ContentEngine";
import { courseComposer } from "../engines/content/CourseComposer";
import { handbookEngine } from "../engines/handbook/HandbookEngine";
import { extractFromText } from "../engines/content/extractors/index";
import { DEFAULT_SETTINGS } from "../data/defaults";
import { COLLECTIONS } from "../data/schema";
import { xpEngine } from "../engines/gamification/XpEngine";
import { workstationEngine } from "../engines/learning/WorkstationEngine";
import { riskEngine } from "../engines/risk/RiskEngine";
import { notificationRepo, riskRepo, peopleRepo } from "../data/repositories/index";

let pass = 0, fail = 0;
function check(name: string, condition: unknown, detail = "") {
  if (condition) { pass++; console.log(`  ok   ${name}${detail ? " — " + detail : ""}`); }
  else { fail++; console.log(`  FALHA ${name}${detail ? " — " + detail : ""}`); }
}

console.log("\n1) Carga inicial");
const report = await runSeed();
check("seed executado", report.seeded);
check("5 cursos", db.count("courses") === 5, `${db.count("courses")}`);
check("25 aulas", db.count("lessons") === 25, `${db.count("lessons")}`);
check("56 questões", db.count("questions") === 56, `${db.count("questions")}`);
check("32 curiosidades", db.count("curiosities") === 32, `${db.count("curiosities")}`);
check("6 jogos", db.count("games") === 6, `${db.count("games")}`);
check("12 desafios", db.count("challenges") === 12, `${db.count("challenges")}`);
check("17 trilhas", db.count("learning_paths") === 17, `${db.count("learning_paths")}`);
check("14 badges", db.count("badges") === 14, `${db.count("badges")}`);
check("12 materiais", db.count("content") === 12, `${db.count("content")}`);
check("apostila gerada pelo motor", db.count("handbooks") >= 1, `${db.count("handbooks")} apostila(s)`);
check("todo material analisado", catalogRepo.contents().every((c) => !!c.analysis));
check("toda questão tem SOURCE_ID", catalogRepo.questions().every((q) => !!q.sourceRef?.sourceId));
check("toda curiosidade tem fonte", catalogRepo.curiosities().every((c) => !!c.sourceRef?.sourceId));

console.log("\n2) Fluxo completo de curso → avaliação → certificado (Joana / NR-1)");
const employeeId = "EMP-0002";
const courseId = "CRS-002";
progressEngine.enroll(employeeId, courseId, "gestor");
for (const lesson of catalogRepo.orderedLessons(courseId)) progressEngine.completeLesson(employeeId, lesson, 300);
check("todas as aulas concluídas", progressEngine.lessonsFinished(employeeId, courseId));
check("progresso 100%", learningRepo.enrollment(employeeId, courseId)?.progressPct === 100);

const quizId = catalogRepo.course(courseId)!.finalQuizId!;
const prepared = quizEngine.prepare(quizId)!;
check("avaliação final preparada", prepared.questions.length > 0, `${prepared.questions.length} questões sorteadas`);
const answers = prepared.questions.map((q) => ({ questionId: q.id, optionId: q.correctOptionId, timeSec: 20 }));
const result = quizEngine.submit(prepared, employeeId, answers, courseId);
check("nota 100%", result.score === 100, `${result.score}%`);
const completion = progressEngine.completeCourse(employeeId, courseId, result.score);
check("curso concluído", completion.enrollment.status === "concluido");
check("certificado emitido", !!completion.certificate, completion.certificate?.code);
check("classificação explícita no certificado", completion.certificate?.classification.toLowerCase().includes("interno"));
const validation = certificateEngine.validate(completion.certificate!.code);
check("certificado valida publicamente", validation.result === "valido");
check("validação registrada para auditoria", certificateRepo.validations(completion.certificate!.code).length === 1);
check("código inexistente não valida", certificateEngine.validate("CSV-0000-0000").result === "nao_encontrado");
check("certificado não duplica", certificateEngine.issue({ employeeId, kind: "curso", refId: courseId, score: 100 })?.code === completion.certificate!.code);

console.log("\n3) Competências e gamificação");
check("evidência de competência registrada", competencyEngine.levelOf(employeeId, "CMP-NR1") > 0, `nível ${competencyEngine.levelOf(employeeId, "CMP-NR1")}`);
check("XP acumulado", xpEngine.totalXp(employeeId) > 500, `${xpEngine.totalXp(employeeId)} XP`);
check("nível calculado", xpEngine.level(employeeId).level >= 2, `nível ${xpEngine.level(employeeId).level} (${xpEngine.level(employeeId).name})`);
check("badge 'Primeiro Curso' concedido", gamificationRepo.hasBadge(employeeId, "BDG-01"));
const gaps = competencyEngine.gaps(employeeId);
check("lacunas identificadas para a função", gaps.length > 0, `${gaps.length} lacunas, maior: ${gaps[0]?.competencyName}`);
check("recomendação aponta curso existente", competencyEngine.recommendations(employeeId).every((r) => !!catalogRepo.course(r.refId)));

console.log("\n4) Aprendizado adaptativo (Maria, com quiz fraco em regulagem)");
const weak = adaptiveEngine.weakPoints("EMP-0001", 3);
check("ponto fraco detectado", weak.length > 0, weak[0] ? `${weak[0].subject} (${Math.round(weak[0].accuracy * 100)}%)` : "");
const recs = adaptiveEngine.recommendations("EMP-0001", 5);
check("recomendações geradas", recs.length > 0, recs.map((r) => r.kind).join(", "));
const reinforcement = quizEngine.buildReinforcementQuiz(["CMP-REGULAGEM"], 5);
check("quiz de reforço montado com questões reais", !!reinforcement && reinforcement.questionIds.length > 0, `${reinforcement?.questionIds.length} questões`);

console.log("\n5) Jogos");
const game = catalogRepo.game("GAM-000001")!;
const outcome = gameEngine.finish(game, employeeId, game.payload.kind === "diagnosis" ? game.payload.rounds.map((r) => ({ roundId: r.id, correct: true })) : [], new Date().toISOString());
check("partida registrada e pontuada", outcome.percent === 100 && outcome.passed, `${outcome.score}/${outcome.maxScore} · +${outcome.xpEarned} XP`);
check("mecânicas registradas", gameEngine.mechanics().length === 4);

console.log("\n6) Aprender no posto (busca em todo o conteúdo publicado)");
const guide = workstationEngine.guide("overloque", "tecido-franzindo")!;
check("guia montado", !!guide);
check("roteiro de verificação encontrado no material", guide.checks.length > 0, `${guide.checks.length} passos`);
check("passos citam a fonte", guide.checks.every((c) => !!c.sourceRef.sourceId));
const stop = workstationEngine.guide("reta", "ruido")!;
check("sintoma mecânico manda parar a máquina", stop.stopMachine);

console.log("\n7) CONTENT_ENGINE: conteúdo novo → análise → aprovação → curso → apostila");
const texto = `A galoneira é a máquina usada para fazer barras e acabamentos elásticos em malha. Ela trabalha com duas ou três agulhas e um looper que forma o ponto por baixo do tecido.

A tensão das agulhas define o aperto do ponto na parte de cima da barra. Tensão alta demais deixa a barra ondulada; tensão baixa demais deixa o ponto frouxo e o acabamento aberto.

O diferencial da galoneira controla o estiramento da malha durante a costura. Em malha leve, diferencial alto evita que a barra fique ondulada.

Roteiro de verificação quando a barra está ondulando:
1. Reduza a tensão das agulhas em pequenos passos.
2. Ajuste o diferencial e teste em retalho do mesmo tecido.
3. Verifique a pressão do calcador.
4. Confira se a agulha é a correta para a malha.
5. Se continuar, pare a máquina e chame a manutenção.

Nunca ajuste a altura do looper sem apoio da manutenção: esse ajuste exige sincronismo e ferramenta específica.`;
const created = contentEngine.createFromUpload({
  title: "Regulagem da Galoneira",
  description: "Manual interno de regulagem da galoneira.",
  category: "costura", level: "intermediario", sector: "Costura", contentType: "manual",
  keywords: ["galoneira", "barra", "tensão"], competencies: [], librarySourceIds: ["SRCLIB-BROTHER"],
  extraction: extractFromText(texto), createdBy: "EMP-0009",
});
check("CONTENT_ID gerado", /^CNT-\d{6}$/.test(created.id), created.id);
check("trechos com SOURCE_ID", created.chunks.length > 0 && created.chunks.every((c) => c.sourceId.startsWith("SRC:")), `${created.chunks.length} trechos`);
const analyzed = (await contentEngine.analyze(created.id, "EMP-0009"))!;
check("status vai para revisão humana", analyzed.status === "pending_review");
const a = analyzed.analysis!;
check("conceitos identificados", a.concepts.length > 0, `${a.concepts.length}`);
check("definições extraídas", a.definitions.length > 0, a.definitions[0]?.term);
check("procedimento identificado", a.procedures.length > 0, `${a.procedures[0]?.steps.length} passos`);
check("riscos identificados", a.risks.length > 0, `${a.risks.length}`);
check("competências sugeridas", a.competencies.length > 0, a.competencies.join(", "));
check("aulas sugeridas", a.suggestions.lessons.length > 0, `${a.suggestions.lessons.length}`);
check("questões sugeridas", a.suggestions.questions.length > 0, `${a.suggestions.questions.length}`);
check("toda questão sugerida tem fonte", a.suggestions.questions.every((q) => !!q.sourceRef.sourceId));
check("jogos sugeridos", a.suggestions.games.length > 0, a.suggestions.games.map((g) => g.type).join(", "));
check("nada publicado automaticamente", catalogRepo.questionsOfContent(created.id).length === 0);

const approvedQuestions = contentEngine.materializeQuestions(analyzed, a.suggestions.questions.slice(0, 5), "EMP-0009");
check("questões aprovadas viram registro", approvedQuestions.length === 5 && approvedQuestions.every((q) => q.status === "approved"));
const composed = courseComposer.compose(created.id, "EMP-0009", "Coordenação", { title: "Galoneira na prática", publish: true })!;
check("curso gerado do material", !!composed && composed.lessonIds.length > 0, `${composed.lessonIds.length} aulas, quiz: ${composed.finalQuiz ? "sim" : "não"}`);
check("curso rastreia o material de origem", composed.course.sourceContentIds.includes(created.id));
const handbook = handbookEngine.generate({ courseId: composed.course.id, author: "Coordenação", createdBy: "EMP-0009", status: "published" });
check("apostila gerada", handbook.sections.length >= 12, `${handbook.sections.length} seções`);
check("apostila tem referências", handbook.references.length > 0, `${handbook.references.length}`);
const kinds = handbook.sections.map((s) => s.kind);
check("estrutura da apostila completa", ["capa", "sumario", "objetivos", "conteudo", "curiosidades", "atividades", "desafios", "quiz", "avaliacao", "gabarito", "referencias", "conclusao"].every((k) => kinds.includes(k as never)));

console.log("\n8) Versionamento e auditoria");
contentEngine.publish(created.id, "EMP-0009", "Coordenação", ["Revisado e publicado"], "Primeira publicação");
check("conteúdo publicado", catalogRepo.content(created.id)?.status === "published");
check("versão registrada", catalogRepo.versionsOf(created.id).length === 1, `v${catalogRepo.content(created.id)?.version}`);
check("auditoria registrou as ações", db.count("audit_logs") >= 7, `${db.count("audit_logs")} registros`);
const actions = new Set(db.list("audit_logs").map((l) => l.action));
check("auditoria cobre certificado e conclusão", actions.has("certificate.issue") && actions.has("course.complete"), [...actions].join(", "));

console.log("\n9) Eu vi um risco: registro, anonimato e tratamento");
const autor = db.byId("employees", "EMP-0002")!;
const gestor = db.byId("employees", "EMP-0008")!;

const anon = riskEngine.report({
  sector: "Costura", place: "Corredor entre linhas", category: "Queda / obstrução",
  description: "Caixas bloqueando a passagem perto da saída de emergência.",
  priority: "alta", anonymous: true,
}, autor);
check("registro anônimo não guarda o colaborador", !anon.report.employeeId && !anon.report.employeeName);
check("XP do anônimo não aponta para o registro (não dá para descobrir quem foi)",
  !gamificationRepo.xpOf(autor.id).some((t) => t.refId === anon.report.id));
check("XP do anônimo mesmo assim é lançado", gamificationRepo.xpOf(autor.id).some((t) => t.reason === "Contribuição com a segurança"));
const logAnon = db.list("audit_logs").find((l) => l.entityId === anon.report.id);
check("auditoria do anônimo não identifica a pessoa", logAnon?.actorId === "anonimo", logAnon?.actorName);
check("linha do tempo do anônimo não tem nome", anon.report.timeline.every((t) => !t.byName));

const ident = riskEngine.report({
  sector: "Estamparia", place: "Bancada de telas", category: "Produto químico",
  description: "Produto de limpeza sem ventilação adequada no fim do turno.",
  priority: "critica", anonymous: false,
}, autor);
check("registro identificado guarda o autor", ident.report.employeeId === autor.id);
check("XP identificado aponta para o registro", gamificationRepo.xpOf(autor.id).some((t) => t.refId === ident.report.id));
check("gestão é notificada do novo risco", notificationRepo.all().some((n) => n.role === "GESTOR" && n.body.includes("Estamparia")));
check("validação recusa descrição curta", riskEngine.validate({ sector: "Costura", place: "", category: "x", description: "curto", priority: "baixa", anonymous: false }) !== null);

const tratado = riskEngine.advance(ident.report, "em_analise", "Verificado no local pela supervisão.", gestor);
check("fluxo avança e registra a linha do tempo", tratado.status === "em_analise" && tratado.timeline.length === 2);
check("quem reportou recebe aviso", notificationRepo.forEmployee(autor.id).some((n) => n.title.includes(ident.report.code)));
const antesAvisos = notificationRepo.all().length;
riskEngine.advance(anon.report, "em_analise", "Verificado.", gestor);
check("registro anônimo não gera aviso para ninguém", notificationRepo.all().length === antesAvisos);
check("próximo status segue o fluxo", riskEngine.nextStatus("acao_definida") === "resolvido");
check("resumo de riscos bate", riskEngine.summary().total === riskRepo.all().length);

console.log("\n10) Curso sem avaliação final: não pode virar beco sem saída");
const textoCurto = `A galoneira precisa de limpeza diária. O fiapo acumulado embaixo da chapa muda o transporte e estraga a barra.

Antes de começar o turno, confira o passamento das linhas e o nível do óleo indicado pelo fabricante.`;
const semProva = contentEngine.createFromUpload({
  title: "Cuidados diários com a galoneira",
  description: "Material curto, sem base para uma avaliação completa.",
  category: "manutencao", level: "basico", sector: "Costura", contentType: "procedimento",
  keywords: ["galoneira"], competencies: ["CMP-GALONEIRA"], librarySourceIds: ["SRCLIB-CONSERV-POP"],
  extraction: extractFromText(textoCurto), createdBy: "EMP-0009",
});
await contentEngine.analyze(semProva.id, "EMP-0009");
const cursoSemProva = courseComposer.compose(semProva.id, "EMP-0009", "Coordenação", {
  title: "Cuidados diários com a galoneira", publish: true,
})!;
check("curso gerado sem avaliação final (questões insuficientes)", !cursoSemProva.finalQuiz);

const aluno = "EMP-0006";
progressEngine.enroll(aluno, cursoSemProva.course.id, "gestor");
const aulasSemProva = catalogRepo.orderedLessons(cursoSemProva.course.id);
let fechamento: ReturnType<typeof progressEngine.completeLesson> | null = null;
for (const aula of aulasSemProva) fechamento = progressEngine.completeLesson(aluno, aula, 120);
check("última aula fecha o curso sozinha", learningRepo.enrollment(aluno, cursoSemProva.course.id)?.status === "concluido");
check("certificado sai mesmo sem avaliação", !!fechamento?.certificate, fechamento?.certificate?.code);
check("aproveitamento registrado como participação", learningRepo.enrollment(aluno, cursoSemProva.course.id)?.finalScore === 100);
check("conclusão aparece na auditoria", db.list("audit_logs").some((l) => l.action === "course.complete" && l.detail?.includes("galoneira")));

console.log("\n11) Ordem de leitura estável entre recarregamentos");
// O armazenamento (localStorage, Supabase) não garante a ordem em que
// devolve as chaves. Se a ordem do banco dependesse disso, as listas da
// tela mudariam a cada F5 — foi o que trocava os perfis de demonstração.
const usuariosAntes = peopleRepo.users().map((u) => u.id);
const cursosAntes = catalogRepo.courses().map((c) => c.id);
const banco: Array<{ key: string; value: string }> = [];
for (const colecao of COLLECTIONS) {
  for (const registro of db.list(colecao) as ReadonlyArray<{ id: string }>) {
    banco.push({ key: `academia:v1:${colecao}:${registro.id}`, value: JSON.stringify(registro) });
  }
}
/** Adaptador que devolve o mesmo banco, mas na ordem inversa das chaves. */
const adaptadorInvertido = {
  name: "Adaptador de teste (ordem invertida)",
  shared: false,
  async get(key: string) { return banco.find((e) => e.key === key)?.value ?? null; },
  async set() { /* nada */ },
  async delete() { /* nada */ },
  async keys() { return banco.map((e) => e.key); },
  async entries() { return [...banco].reverse(); },
  async setMany() { /* nada */ },
  async deleteMany() { /* nada */ },
};
db.useAdapter(adaptadorInvertido);
await db.load();
check("ordem dos usuários não muda quando o armazenamento inverte as chaves",
  peopleRepo.users().map((u) => u.id).join(",") === usuariosAntes.join(","));
check("ordem dos cursos não muda quando o armazenamento inverte as chaves",
  catalogRepo.courses().map((c) => c.id).join(",") === cursosAntes.join(","));
check("a lista sai ordenada por ID (ordem reproduzível)",
  peopleRepo.users().map((u) => u.id).join(",") === [...usuariosAntes].sort().join(","),
  peopleRepo.users().map((u) => u.id).join(","));
const ativos = peopleRepo.activeEmployees().map((e) => e.id);
check("filtro herda a mesma ordem estável", ativos.join(",") === [...ativos].sort().join(","));

// O acesso de demonstração precisa mostrar um perfil de cada papel,
// independente da ordem em que os usuários chegam do armazenamento.
const perfisDemo = (["COLABORADOR", "INSTRUTOR", "GESTOR", "ADMIN"] as const)
  .map((papel) => peopleRepo.users().find((u) => u.active && u.role === papel))
  .filter((u): u is NonNullable<typeof u> => !!u);
check("há um perfil de demonstração para cada papel", perfisDemo.length === 4, `${perfisDemo.length} de 4`);
check("todo perfil de demonstração tem colaborador vinculado",
  perfisDemo.every((u) => !!peopleRepo.employee(u.employeeId)));

console.log("\n12) Robustez: carga interrompida e falha de gravação");
const configSalva = settingsRepo.get();
check("carga completa é reconhecida", isSeeded());
db.put("settings", { ...configSalva, seedCompletedAt: undefined });
check("carga interrompida no meio é detectada (e seria refeita)", !isSeeded());
db.put("settings", configSalva);
check("estado restaurado", isSeeded());

const adaptadorComFalha = {
  name: "Adaptador de teste (sempre falha)",
  shared: false,
  async get() { return null; },
  async set() { throw new Error("sem conexão com o banco"); },
  async delete() { /* nada */ },
  async keys() { return [] as string[]; },
  async entries() { return [] as Array<{ key: string; value: string }>; },
  async setMany() { throw new Error("sem conexão com o banco"); },
  async deleteMany() { /* nada */ },
};
db.useAdapter(adaptadorComFalha);
db.put("settings", { ...DEFAULT_SETTINGS });
await new Promise((r) => setTimeout(r, 60));
check("falha de gravação aparece no status do banco", (db.status().lastError ?? "").includes("sem conexão"), db.status().lastError ?? "");
check("aviso de leitura não é confundido com falha de gravação", db.status().loadWarnings.length === 0);

console.log(`\n=== ${pass} passaram, ${fail} falharam ===`);
if (fail > 0) process.exit(1);
