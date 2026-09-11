import { useEffect, useState } from "react";
import type { AiSettings, ContentItem } from "../../core/types";
import { auditRepo, catalogRepo, competencyRepo, settingsRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useRouter } from "../../router/Router";
import { useToast } from "../../state/ToastContext";
import { contentEngine } from "../../engines/content/ContentEngine";
import { courseComposer } from "../../engines/content/CourseComposer";
import { handbookEngine } from "../../engines/handbook/HandbookEngine";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card, SectionTitle } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip, StatusChip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { Tabs } from "../../ui/primitives/Tabs";
import { Modal } from "../../ui/primitives/Modal";
import { Field, Select, TextArea, TextInput, CheckboxRow, Toggle } from "../../ui/primitives/Field";
import { Callout, EmptyState } from "../../ui/primitives/Feedback";
import { BlockList } from "../../ui/content/BlockRenderer";
import { SourceBadge } from "../../ui/primitives/SourceBadge";
import { formatDateTime, relativeFrom } from "../../core/dates";
import { cn } from "../../core/cn";

export function ContentDetailPage({ contentId }: { contentId: string }) {
  const { employee } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState("resumo");
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<Record<string, Set<number>>>({});
  const [modal, setModal] = useState<null | "reanalisar" | "curso" | "apostila" | "rejeitar">(null);

  const content = useQuery(() => catalogRepo.content(contentId), [contentId]);
  const versions = useQuery(() => catalogRepo.versionsOf(contentId), [contentId]);
  const generated = useQuery(() => {
    if (!content) return null;
    return {
      questions: catalogRepo.questionsOfContent(contentId),
      lessons: content.generated.lessonIds.map((id) => catalogRepo.lesson(id)).filter(Boolean),
      curiosities: content.generated.curiosityIds.map((id) => catalogRepo.curiosity(id)).filter(Boolean),
      games: content.generated.gameIds.map((id) => catalogRepo.game(id)).filter(Boolean),
      challenges: content.generated.challengeIds.map((id) => catalogRepo.challenge(id)).filter(Boolean),
      courses: content.generated.courseIds.map((id) => catalogRepo.course(id)).filter(Boolean),
      handbooks: content.generated.handbookIds.map((id) => catalogRepo.handbook(id)).filter(Boolean),
    };
  }, [contentId, content?.updatedAt]);

  useEffect(() => {
    setSelection({});
  }, [contentId]);

  if (!content) return <EmptyState icon="file" title="Conteúdo não encontrado" />;
  const analysis = content.analysis;
  const summary = contentEngine.analysisSummary(analysis);

  const toggle = (group: string, index: number) => {
    setSelection((current) => {
      const set = new Set(current[group] ?? []);
      if (set.has(index)) set.delete(index);
      else set.add(index);
      return { ...current, [group]: set };
    });
  };
  const selectAll = (group: string, total: number) => {
    setSelection((current) => {
      const all = current[group]?.size === total;
      return { ...current, [group]: all ? new Set<number>() : new Set(Array.from({ length: total }, (_, i) => i)) };
    });
  };
  const picked = (group: string) => [...(selection[group] ?? [])].sort((a, b) => a - b);

  // ---------------- ações ----------------
  const approveQuestions = () => {
    if (!analysis || !employee) return;
    const chosen = picked("questions").map((i) => analysis.suggestions.questions[i]).filter(Boolean);
    if (chosen.length === 0) return toast.error("Selecione ao menos uma questão.");
    const created = contentEngine.materializeQuestions(content, chosen, employee.id, content.generated.courseIds[0]);
    toast.success(`${created.length} questão(ões) aprovadas`, "Já disponíveis para quizzes e jogos.");
    setSelection((s) => ({ ...s, questions: new Set() }));
  };

  const approveCuriosities = () => {
    if (!analysis || !employee) return;
    const chosen = picked("curiosities").map((i) => analysis.suggestions.curiosities[i]).filter(Boolean);
    if (chosen.length === 0) return toast.error("Selecione ao menos uma curiosidade.");
    contentEngine.materializeCuriosities(content, chosen, employee.id);
    toast.success(`${chosen.length} curiosidade(s) publicadas`);
    setSelection((s) => ({ ...s, curiosities: new Set() }));
  };

  const approveChallenges = () => {
    if (!analysis || !employee) return;
    const chosen = picked("challenges").map((i) => analysis.suggestions.challenges[i]).filter(Boolean);
    if (chosen.length === 0) return toast.error("Selecione ao menos um desafio.");
    contentEngine.materializeChallenges(content, chosen, employee.id);
    toast.success(`${chosen.length} desafio(s) publicados`);
    setSelection((s) => ({ ...s, challenges: new Set() }));
  };

  const approveGames = () => {
    if (!analysis || !employee) return;
    const chosen = picked("games").map((i) => analysis.suggestions.games[i]).filter(Boolean);
    if (chosen.length === 0) return toast.error("Selecione ao menos um jogo.");
    const questionIds = catalogRepo.questionsOfContent(content.id).filter((q) => q.status === "approved").map((q) => q.id);
    contentEngine.materializeGames(content, chosen, employee.id, questionIds);
    toast.success(`${chosen.length} jogo(s) publicados`);
    setSelection((s) => ({ ...s, games: new Set() }));
  };

  const publish = () => {
    if (!employee) return;
    contentEngine.publish(content.id, employee.id, employee.name, ["Conteúdo aprovado e publicado após revisão humana"]);
    toast.success("Conteúdo publicado", `${content.id} v${content.version}`);
  };

  return (
    <div>
      <PageHeader
        title={content.title}
        subtitle={`${content.id} · v${content.version} · ${content.contentType} · ${content.category}`}
        icon="file"
        back={{ to: "/admin/conteudos", label: "Conteúdos" }}
        action={<StatusChip status={content.status} />}
      />

      {/* Ações principais (seção 35) */}
      <Card className="p-4 mb-5">
        <div className="flex flex-wrap gap-2">
          <Button icon="sparkles" variant="secondary" onClick={() => setModal("reanalisar")} loading={busy}>Reanalisar</Button>
          <Button
            icon="clipboard"
            variant="secondary"
            disabled={(generated?.questions.length ?? 0) < 3}
            onClick={() => {
              const questionIds = (generated?.questions ?? []).filter((q) => q.status === "approved").map((q) => q.id);
              if (questionIds.length < 3) return toast.error("Aprove ao menos 3 questões antes de gerar o quiz.");
              const quiz = catalogRepo.saveQuiz({
                id: `QIZ-${content.id}`,
                title: `Quiz — ${content.title}`,
                description: "Quiz gerado a partir do material aprovado.",
                scope: "avulso",
                refId: content.id,
                questionIds,
                drawCount: Math.min(8, questionIds.length),
                passScore: settingsRepo.get().defaultPassScore,
                shuffleOptions: true,
                xp: 50,
                status: "published",
                createdAt: new Date().toISOString(),
              });
              toast.success("Quiz gerado", quiz.title);
            }}
          >
            Gerar quiz
          </Button>
          <Button icon="gamepad-2" variant="secondary" onClick={() => setTab("games")}>Gerar jogos</Button>
          <Button icon="printer" variant="secondary" onClick={() => setModal("apostila")}>Gerar apostila</Button>
          <Button icon="book-open" variant="secondary" onClick={() => setModal("curso")}>Gerar curso</Button>
          {content.status !== "published" && <Button icon="check" variant="primary" onClick={publish}>Aprovar e publicar</Button>}
          {content.status !== "rejected" && <Button icon="x" variant="ghost" onClick={() => setModal("rejeitar")}>Rejeitar</Button>}
        </div>
      </Card>

      {/* Conteúdo identificado */}
      {summary ? (
        <>
          <Card className="p-4 mb-5">
            <SectionTitle hint={`Analisado por: ${summary.provider} · ${relativeFrom(analysis!.analyzedAt)}`}>
              Conteúdo identificado
            </SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-2.5">
              <Counter label="conceitos" value={summary.concepts} icon="shapes" />
              <Counter label="competências" value={summary.competencies} icon="target" />
              <Counter label="assuntos" value={summary.subjects} icon="layers" />
              <Counter label="questões possíveis" value={summary.questions} icon="clipboard" />
              <Counter label="desafios" value={summary.challenges} icon="zap" />
              <Counter label="jogos sugeridos" value={summary.games} icon="gamepad-2" />
              <Counter label="aulas sugeridas" value={summary.lessons} icon="book-open" />
              <Counter label="curiosidades" value={summary.curiosities} icon="lightbulb" />
              <Counter label="riscos citados" value={summary.risks} icon="siren" />
              <Counter label="procedimentos" value={summary.procedures} icon="list-ordered" />
              <Counter label="min de leitura" value={summary.readingMinutes} icon="clock" />
              <Counter label="avisos" value={summary.warnings} icon="alert" />
            </div>
          </Card>

          {analysis!.warnings.length > 0 && (
            <Callout tone="alerta" title="A análise pediu atenção humana">
              <ul className="list-disc pl-4 space-y-1">
                {analysis!.warnings.map((warning, i) => <li key={i}>{warning}</li>)}
              </ul>
            </Callout>
          )}

          <div className="mt-5">
            <Tabs
              active={tab}
              onChange={setTab}
              items={[
                { id: "resumo", label: "Resumo", icon: "file" },
                { id: "lessons", label: "Aulas", icon: "book-open", badge: analysis!.suggestions.lessons.length },
                { id: "questions", label: "Questões", icon: "clipboard", badge: analysis!.suggestions.questions.length },
                { id: "curiosities", label: "Curiosidades", icon: "lightbulb", badge: analysis!.suggestions.curiosities.length },
                { id: "challenges", label: "Desafios", icon: "zap", badge: analysis!.suggestions.challenges.length },
                { id: "games", label: "Jogos", icon: "gamepad-2", badge: analysis!.suggestions.games.length },
                { id: "texto", label: "Ver conteúdo", icon: "scroll" },
                { id: "gerado", label: "Já publicado", icon: "check-circle" },
                { id: "versoes", label: "Versões", icon: "clock", badge: versions.length },
              ]}
            />
          </div>

          <div className="mt-4">
            {tab === "resumo" && <ResumoTab content={content} />}

            {tab === "lessons" && (
              <SuggestionGroup
                title="Aulas sugeridas"
                hint="Montadas com os trechos do próprio material — nada reescrito sem fonte."
                total={analysis!.suggestions.lessons.length}
                group="lessons"
                selection={selection}
                onToggleAll={selectAll}
                action={
                  <Button
                    icon="book-open"
                    onClick={() => setModal("curso")}
                  >
                    Criar curso com as aulas
                  </Button>
                }
              >
                {analysis!.suggestions.lessons.map((lesson, index) => (
                  <div key={index} className="rounded-xl border border-sand bg-linen-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-[15px]">{lesson.title}</h4>
                        <p className="text-[13px] text-ink-600 mt-0.5">{lesson.summary}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Chip tone="neutral">{lesson.durationMin} min</Chip>
                        <Chip tone="navy">{lesson.blocks.length} blocos</Chip>
                      </div>
                    </div>
                    <details className="mt-3">
                      <summary className="text-[12.5px] font-semibold text-navy cursor-pointer">Pré-visualizar aula</summary>
                      <div className="mt-3 pt-3 border-t border-sand/60">
                        <BlockList blocks={lesson.blocks} dense />
                      </div>
                    </details>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {lesson.competencies.map((id) => <Chip key={id} tone="sand">{competencyRepo.name(id)}</Chip>)}
                    </div>
                  </div>
                ))}
              </SuggestionGroup>
            )}

            {tab === "questions" && (
              <SuggestionGroup
                title="Questões sugeridas"
                hint="Cada questão traz o SOURCE_ID do trecho que a sustenta. Questões marcadas como incertas nasceram de interpretação."
                total={analysis!.suggestions.questions.length}
                group="questions"
                selection={selection}
                onToggleAll={selectAll}
                action={<Button icon="check" onClick={approveQuestions}>Aprovar selecionadas</Button>}
              >
                {analysis!.suggestions.questions.map((question, index) => (
                  <CheckboxRow
                    key={index}
                    checked={(selection.questions ?? new Set()).has(index)}
                    onChange={() => toggle("questions", index)}
                    title={
                      <span>
                        {question.stem}
                        {question.confidence < 0.6 && <Chip tone="copper" className="ml-2">revisar</Chip>}
                      </span>
                    }
                    description={
                      <span className="block space-y-1">
                        <ol className="list-[upper-alpha] pl-5 space-y-0.5">
                          {question.options.map((option, i) => (
                            <li key={i} className={cn(i === question.correctIndex && "font-semibold text-jade-600")}>{option}</li>
                          ))}
                        </ol>
                        <span className="block text-[12.5px] mt-1">{question.explanation}</span>
                        <span className="flex flex-wrap items-center gap-2 mt-1">
                          <Chip tone="neutral">{question.difficulty}</Chip>
                          <Chip tone="sand">{question.type.replace(/_/g, " ")}</Chip>
                          <Chip tone="navy">{question.subject}</Chip>
                          <SourceBadge sourceRef={question.sourceRef} />
                        </span>
                      </span>
                    }
                  />
                ))}
              </SuggestionGroup>
            )}

            {tab === "curiosities" && (
              <SuggestionGroup
                title="Curiosidades sugeridas"
                hint="Frases do próprio material, reenquadradas como “Você sabia?”."
                total={analysis!.suggestions.curiosities.length}
                group="curiosities"
                selection={selection}
                onToggleAll={selectAll}
                action={<Button icon="check" onClick={approveCuriosities}>Publicar selecionadas</Button>}
              >
                {analysis!.suggestions.curiosities.map((curiosity, index) => (
                  <CheckboxRow
                    key={index}
                    checked={(selection.curiosities ?? new Set()).has(index)}
                    onChange={() => toggle("curiosities", index)}
                    title={curiosity.title}
                    description={
                      <span className="block">
                        {curiosity.text}
                        <span className="block mt-1"><SourceBadge sourceRef={curiosity.sourceRef} /></span>
                      </span>
                    }
                  />
                ))}
              </SuggestionGroup>
            )}

            {tab === "challenges" && (
              <SuggestionGroup
                title="Desafios sugeridos"
                hint="Nascem de frases prescritivas do material. Sempre revise se a conduta corresponde ao padrão da empresa."
                total={analysis!.suggestions.challenges.length}
                group="challenges"
                selection={selection}
                onToggleAll={selectAll}
                action={<Button icon="check" onClick={approveChallenges}>Publicar selecionados</Button>}
              >
                {analysis!.suggestions.challenges.map((challenge, index) => (
                  <CheckboxRow
                    key={index}
                    checked={(selection.challenges ?? new Set()).has(index)}
                    onChange={() => toggle("challenges", index)}
                    title={challenge.title}
                    description={
                      <span className="block space-y-1">
                        <span className="block">{challenge.scenario}</span>
                        <ol className="list-[upper-alpha] pl-5">
                          {challenge.options.map((option, i) => (
                            <li key={i} className={cn(i === challenge.correctIndex && "font-semibold text-jade-600")}>{option}</li>
                          ))}
                        </ol>
                        <span className="block"><SourceBadge sourceRef={challenge.sourceRef} /></span>
                      </span>
                    }
                  />
                ))}
              </SuggestionGroup>
            )}

            {tab === "games" && (
              <SuggestionGroup
                title="Jogos sugeridos"
                hint="O motor só sugere mecânica que o material sustenta (sem passo a passo, não há jogo de sequência)."
                total={analysis!.suggestions.games.length}
                group="games"
                selection={selection}
                onToggleAll={selectAll}
                action={<Button icon="check" onClick={approveGames}>Publicar selecionados</Button>}
              >
                {analysis!.suggestions.games.map((game, index) => (
                  <CheckboxRow
                    key={index}
                    checked={(selection.games ?? new Set()).has(index)}
                    onChange={() => toggle("games", index)}
                    title={game.title}
                    description={
                      <span className="block">
                        <span className="block">{game.pitch}</span>
                        <span className="block text-[12.5px] mt-1">{game.reason}</span>
                        <span className="flex flex-wrap gap-1.5 mt-1.5">
                          <Chip tone="navy">{game.type.replace(/_/g, " ")}</Chip>
                          <Chip tone="sand">{game.payload.kind}</Chip>
                          <Chip tone="neutral">
                            {game.payload.kind === "diagnosis" ? `${game.payload.rounds.length} situações`
                              : game.payload.kind === "sequence" ? `${game.payload.rounds.length} rodadas`
                              : game.payload.kind === "timed_quiz" ? `${game.payload.rounds[0]?.inlineQuestions?.length ?? 0} perguntas`
                              : `${game.payload.rounds.length} cenas`}
                          </Chip>
                        </span>
                      </span>
                    }
                  />
                ))}
              </SuggestionGroup>
            )}

            {tab === "texto" && (
              <Card className="p-4 sm:p-5">
                <SectionTitle hint="Cada parágrafo tem um SOURCE_ID: é a unidade de rastreabilidade do sistema.">
                  Trechos extraídos ({content.chunks.length})
                </SectionTitle>
                <ol className="space-y-3">
                  {content.chunks.map((chunk) => (
                    <li key={chunk.index} className="rounded-xl border border-sand/70 bg-linen-100/40 p-3.5">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <Chip tone="neutral">{chunk.locator ?? `trecho ${chunk.index + 1}`}</Chip>
                        <code className="text-[11px] text-ink-400">{chunk.sourceId}</code>
                      </div>
                      <p className="text-[14px] leading-relaxed">{chunk.text}</p>
                    </li>
                  ))}
                </ol>
              </Card>
            )}

            {tab === "gerado" && generated && (
              <div className="grid gap-3 sm:grid-cols-2">
                <GeneratedCard title="Questões aprovadas" items={generated.questions.map((q) => q!.stem)} icon="clipboard" onOpen={() => navigate("/admin/quizzes")} />
                <GeneratedCard title="Aulas criadas" items={generated.lessons.map((l) => l!.title)} icon="book-open" onOpen={() => navigate("/admin/cursos")} />
                <GeneratedCard title="Curiosidades" items={generated.curiosities.map((c) => c!.title)} icon="lightbulb" onOpen={() => navigate("/curiosidades")} />
                <GeneratedCard title="Desafios" items={generated.challenges.map((c) => c!.title)} icon="zap" onOpen={() => navigate("/desafios")} />
                <GeneratedCard title="Jogos" items={generated.games.map((g) => g!.title)} icon="gamepad-2" onOpen={() => navigate("/admin/jogos")} />
                <GeneratedCard title="Cursos" items={generated.courses.map((c) => c!.title)} icon="graduation-cap" onOpen={() => navigate("/admin/cursos")} />
                <GeneratedCard title="Apostilas" items={generated.handbooks.map((h) => h!.title)} icon="printer" onOpen={() => navigate("/admin/apostilas")} />
              </div>
            )}

            {tab === "versoes" && (
              <Card className="p-4">
                <SectionTitle hint="Quem alterou, quando, o que mudou, fonte e motivo (seção 37).">Histórico de versões</SectionTitle>
                {versions.length === 0 ? (
                  <p className="text-[14px] text-ink-600">Nenhuma versão registrada além da original.</p>
                ) : (
                  <ol className="space-y-3">
                    {versions.map((version) => (
                      <li key={version.id} className="rounded-xl border border-sand/70 p-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip tone="navy">v{version.version}</Chip>
                          <span className="text-[13px] font-semibold">{version.changedByName}</span>
                          <span className="text-[12px] text-ink-400">{formatDateTime(version.changedAt)}</span>
                        </div>
                        <ul className="mt-1.5 list-disc pl-5 text-[13.5px]">
                          {version.changes.map((change, i) => <li key={i}>{change}</li>)}
                        </ul>
                        {version.reason && <p className="text-[12.5px] text-ink-600 mt-1">Motivo: {version.reason}</p>}
                        {version.sourceNote && <p className="text-[12px] text-ink-400 mt-0.5">Fonte: {version.sourceNote}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            )}
          </div>
        </>
      ) : (
        <Card className="p-6 text-center">
          <Icon name="sparkles" size={32} className="mx-auto text-ink-400" />
          <h3 className="font-bold text-[16px] mt-2">Este conteúdo ainda não foi analisado</h3>
          <p className="text-[14px] text-ink-600 mt-1 max-w-md mx-auto">
            A análise identifica conceitos, competências, riscos e procedimentos e sugere aulas, questões, curiosidades,
            desafios e jogos — sempre com a fonte registrada.
          </p>
          <Button
            className="mt-4"
            icon="sparkles"
            loading={busy}
            onClick={async () => {
              if (!employee) return;
              setBusy(true);
              await contentEngine.analyze(content.id, employee.id);
              setBusy(false);
              toast.success("Análise concluída");
            }}
          >
            Analisar conteúdo
          </Button>
        </Card>
      )}

      {/* ---------------- modais ---------------- */}
      <ReanalyzeModal
        open={modal === "reanalisar"}
        onClose={() => setModal(null)}
        content={content}
        onRun={async (overrides) => {
          if (!employee) return;
          setBusy(true);
          setModal(null);
          await contentEngine.reanalyze(content.id, employee.id, overrides);
          setBusy(false);
          toast.success("Conteúdo reanalisado com as novas configurações");
        }}
      />

      <CourseModal
        open={modal === "curso"}
        onClose={() => setModal(null)}
        content={content}
        onCreate={(options) => {
          if (!employee) return;
          const composed = courseComposer.compose(content.id, employee.id, employee.name, options);
          setModal(null);
          if (!composed) {
            toast.error("Não há aulas sugeridas suficientes. Analise o conteúdo primeiro.");
            return;
          }
          toast.success("Curso criado", `${composed.course.title} · ${composed.lessonIds.length} aulas`);
          navigate(`/admin/cursos/${composed.course.id}`);
        }}
      />

      <HandbookModal
        open={modal === "apostila"}
        onClose={() => setModal(null)}
        defaultAuthor={employee?.name ?? ""}
        courseOptions={content.generated.courseIds.map((id) => catalogRepo.course(id)).filter(Boolean).map((c) => ({ id: c!.id, title: c!.title }))}
        onGenerate={(input) => {
          if (!employee) return;
          const handbook = handbookEngine.generate({
            courseId: input.courseId || undefined,
            contentIds: [content.id],
            title: input.title || content.title,
            author: input.author,
            version: input.version,
            includeAnswerKey: input.answerKey,
            createdBy: employee.id,
            status: "published",
          });
          auditRepo.log({ actorId: employee.id, actorName: employee.name, action: "handbook.generate", entity: "handbook", entityId: handbook.id, detail: handbook.title });
          setModal(null);
          toast.success("Apostila gerada", handbook.title);
          navigate(`/apostila/${handbook.id}`);
        }}
      />

      <RejectModal
        open={modal === "rejeitar"}
        onClose={() => setModal(null)}
        onReject={(reason) => {
          if (!employee) return;
          contentEngine.reject(content.id, employee.id, employee.name, reason);
          setModal(null);
          toast.success("Conteúdo marcado como rejeitado");
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Partes da tela
// ---------------------------------------------------------------------

function Counter({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-xl border border-sand/70 bg-linen-100/50 p-3 flex items-center gap-2.5">
      <Icon name={icon} size={17} className="text-ink-600 shrink-0" />
      <div className="min-w-0">
        <div className="text-[17px] font-bold leading-none tabular-nums">{value}</div>
        <div className="text-[11px] text-ink-600 truncate">{label}</div>
      </div>
    </div>
  );
}

function ResumoTab({ content }: { content: ContentItem }) {
  const analysis = content.analysis!;
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <SectionTitle>Resumo gerado</SectionTitle>
        <p className="text-[14.5px] leading-relaxed">{analysis.summary}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Chip tone="navy">{analysis.difficulty}</Chip>
          <Chip tone="neutral">{analysis.stats.words} palavras</Chip>
          <Chip tone="neutral">{analysis.stats.sentences} frases</Chip>
          <Chip tone="sand">{analysis.stats.chunks} trechos</Chip>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>Conceitos e termos técnicos</SectionTitle>
          <ul className="space-y-2">
            {analysis.concepts.map((concept) => (
              <li key={concept.term} className="text-[13.5px]">
                <div className="flex items-center gap-2">
                  <strong>{concept.term}</strong>
                  <Chip tone="neutral">{concept.occurrences}x</Chip>
                  {concept.competencyId && <Chip tone="sand">{competencyRepo.name(concept.competencyId)}</Chip>}
                </div>
                {concept.definition && <p className="text-ink-600 mt-0.5">{concept.definition}</p>}
                {concept.sourceRefs[0] && <SourceBadge sourceRef={concept.sourceRefs[0]} />}
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          {analysis.definitions.length > 0 && (
            <Card className="p-4">
              <SectionTitle>Definições encontradas</SectionTitle>
              <ul className="space-y-2">
                {analysis.definitions.slice(0, 8).map((definition, i) => (
                  <li key={i} className="text-[13.5px]">
                    <strong>{definition.term}:</strong> {definition.text}
                    <SourceBadge sourceRef={definition.sourceRef} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {analysis.procedures.length > 0 && (
            <Card className="p-4">
              <SectionTitle>Procedimentos identificados</SectionTitle>
              {analysis.procedures.map((procedure, i) => (
                <div key={i} className="mb-3">
                  <div className="font-semibold text-[13.5px]">{procedure.title}</div>
                  <ol className="list-decimal pl-5 text-[13px] text-ink-600 mt-1 space-y-0.5">
                    {procedure.steps.map((step, j) => <li key={j}>{step}</li>)}
                  </ol>
                  <SourceBadge sourceRef={procedure.sourceRef} />
                </div>
              ))}
            </Card>
          )}

          {analysis.risks.length > 0 && (
            <Card className="p-4">
              <SectionTitle>Riscos citados</SectionTitle>
              <ul className="space-y-2">
                {analysis.risks.map((risk, i) => (
                  <li key={i} className="text-[13.5px]">
                    <Chip tone="alert" className="mr-1.5">{risk.category}</Chip>
                    {risk.description}
                    <SourceBadge sourceRef={risk.sourceRef} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <Card className="p-4">
        <SectionTitle>Competências sugeridas</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {analysis.competencies.map((id) => <Chip key={id} tone="navy">{competencyRepo.name(id)}</Chip>)}
          {analysis.competencies.length === 0 && <p className="text-[13.5px] text-ink-600">Nenhuma competência reconhecida automaticamente.</p>}
        </div>
      </Card>
    </div>
  );
}

function SuggestionGroup({ title, hint, total, group, selection, onToggleAll, action, children }: {
  title: string;
  hint: string;
  total: number;
  group: string;
  selection: Record<string, Set<number>>;
  onToggleAll: (group: string, total: number) => void;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  const count = selection[group]?.size ?? 0;
  if (total === 0) {
    return <EmptyState icon="sparkles" title={`Nenhuma sugestão de ${title.toLowerCase()}`} description="O material não ofereceu base suficiente. Reanalise com outras configurações ou envie um material mais completo." />;
  }
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[17px] font-bold">{title}</h2>
          <p className="text-[13px] text-ink-600 mt-0.5 max-w-xl">{hint}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" variant="ghost" onClick={() => onToggleAll(group, total)}>
            {count === total ? "Limpar seleção" : "Selecionar todas"}
          </Button>
          {count > 0 && <Chip tone="navy">{count} selecionada(s)</Chip>}
          {action}
        </div>
      </div>
      <div className="space-y-2.5">{children}</div>
    </Card>
  );
}

function GeneratedCard({ title, items, icon, onOpen }: { title: string; items: string[]; icon: string; onOpen: () => void }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon name={icon} size={17} className="text-ink-600" />
        <h3 className="font-bold text-[14.5px]">{title}</h3>
        <Chip tone="neutral" className="ml-auto">{items.length}</Chip>
      </div>
      {items.length === 0 ? (
        <p className="text-[13px] text-ink-600">Nada publicado ainda a partir deste material.</p>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, 6).map((item, i) => (
            <li key={i} className="text-[13px] text-ink-600 truncate">• {item}</li>
          ))}
          {items.length > 6 && <li className="text-[12px] text-ink-400">+ {items.length - 6} outros</li>}
        </ul>
      )}
      <Button size="sm" variant="ghost" className="mt-2" onClick={onOpen}>Abrir</Button>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Modais
// ---------------------------------------------------------------------

function ReanalyzeModal({ open, onClose, content, onRun }: {
  open: boolean;
  onClose: () => void;
  content: ContentItem;
  onRun: (overrides: Partial<AiSettings>) => void;
}) {
  const base = settingsRepo.get().ai;
  const [overrides, setOverrides] = useState<Partial<AiSettings>>({});
  const value = { ...base, ...overrides };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reanalisar conteúdo"
      subtitle={`${content.id} · a IA é controlável: ajuste quantidade, nível e tom (seção 36)`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button icon="sparkles" onClick={() => onRun(overrides)}>Reanalisar</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Quantidade de questões">
          <TextInput type="number" min={1} max={30} value={value.questionsPerContent}
            onChange={(e) => setOverrides({ ...overrides, questionsPerContent: Number(e.target.value) })} />
        </Field>
        <Field label="Aulas sugeridas">
          <TextInput type="number" min={1} max={12} value={value.lessonsPerContent}
            onChange={(e) => setOverrides({ ...overrides, lessonsPerContent: Number(e.target.value) })} />
        </Field>
        <Field label="Curiosidades">
          <TextInput type="number" min={0} max={12} value={value.curiositiesPerContent}
            onChange={(e) => setOverrides({ ...overrides, curiositiesPerContent: Number(e.target.value) })} />
        </Field>
        <Field label="Desafios">
          <TextInput type="number" min={0} max={8} value={value.challengesPerContent}
            onChange={(e) => setOverrides({ ...overrides, challengesPerContent: Number(e.target.value) })} />
        </Field>
        <Field label="Jogos">
          <TextInput type="number" min={0} max={6} value={value.gamesPerContent}
            onChange={(e) => setOverrides({ ...overrides, gamesPerContent: Number(e.target.value) })} />
        </Field>
        <Field label="Nível">
          <Select value={value.level} onChange={(e) => setOverrides({ ...overrides, level: e.target.value as AiSettings["level"] })}>
            <option value="basico">Básico</option>
            <option value="intermediario">Intermediário</option>
            <option value="avancado">Avançado</option>
          </Select>
        </Field>
        <Field label="Tom">
          <Select value={value.tone} onChange={(e) => setOverrides({ ...overrides, tone: e.target.value as AiSettings["tone"] })}>
            <option value="didatico">Didático</option>
            <option value="direto">Direto</option>
            <option value="motivador">Motivador</option>
            <option value="tecnico">Técnico</option>
          </Select>
        </Field>
        <Field label="Público">
          <TextInput value={value.audience} onChange={(e) => setOverrides({ ...overrides, audience: e.target.value })} />
        </Field>
      </div>
      <Callout tone="info" title="Regras que a IA sempre segue" >
        Usar somente este material · preservar a fonte (SOURCE_ID) · não inventar informação técnica ·
        sinalizar o que é incerto · não transformar material educativo em aconselhamento jurídico ·
        nada publicado sem revisão humana.
      </Callout>
    </Modal>
  );
}

function CourseModal({ open, onClose, content, onCreate }: {
  open: boolean;
  onClose: () => void;
  content: ContentItem;
  onCreate: (options: { title: string; hours: number; lessonsPerModule: number; publish: boolean; pathId?: string }) => void;
}) {
  const paths = catalogRepo.paths();
  const [form, setForm] = useState({ title: content.title, hours: 2, lessonsPerModule: 2, publish: false, pathId: "" });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gerar curso a partir do material"
      subtitle="O curso nasce com as aulas aprovadas e uma avaliação final com as questões aprovadas."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button icon="book-open" onClick={() => onCreate({ ...form, pathId: form.pathId || undefined })}>Gerar curso</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Título do curso"><TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Carga horária (h)">
            <TextInput type="number" min={1} value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} />
          </Field>
          <Field label="Aulas por módulo">
            <TextInput type="number" min={1} max={6} value={form.lessonsPerModule} onChange={(e) => setForm({ ...form, lessonsPerModule: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Vincular a uma trilha (opcional)">
          <Select value={form.pathId} onChange={(e) => setForm({ ...form, pathId: e.target.value })}>
            <option value="">Sem trilha</option>
            {paths.map((path) => <option key={path.id} value={path.id}>{path.title}</option>)}
          </Select>
        </Field>
        <Toggle
          checked={form.publish}
          onChange={(publish) => setForm({ ...form, publish })}
          label="Publicar imediatamente"
          hint="Deixe desligado para revisar o curso antes de liberar aos colaboradores."
        />
      </div>
    </Modal>
  );
}

function HandbookModal({ open, onClose, defaultAuthor, courseOptions, onGenerate }: {
  open: boolean;
  onClose: () => void;
  defaultAuthor: string;
  courseOptions: Array<{ id: string; title: string }>;
  onGenerate: (input: { title: string; author: string; version: string; answerKey: boolean; courseId: string }) => void;
}) {
  const [form, setForm] = useState({ title: "", author: defaultAuthor, version: "1.0", answerKey: true, courseId: courseOptions[0]?.id ?? "" });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gerar apostila"
      subtitle="Capa, sumário, objetivos, conteúdo, curiosidades, atividades, desafios, quiz, avaliação, gabarito e referências."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button icon="printer" onClick={() => onGenerate(form)}>Gerar apostila</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Título (vazio = título do material)"><TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Autor / responsável"><TextInput value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></Field>
          <Field label="Versão"><TextInput value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></Field>
        </div>
        {courseOptions.length > 0 && (
          <Field label="Usar o conteúdo de um curso gerado" hint="A apostila fica mais completa quando o curso já existe.">
            <Select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
              <option value="">Só o material</option>
              {courseOptions.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </Select>
          </Field>
        )}
        <Toggle checked={form.answerKey} onChange={(answerKey) => setForm({ ...form, answerKey })} label="Incluir gabarito" hint="Pode desligar na versão entregue ao aluno." />
      </div>
    </Modal>
  );
}

function RejectModal({ open, onClose, onReject }: { open: boolean; onClose: () => void; onReject: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rejeitar conteúdo"
      subtitle="Explique o motivo — fica registrado na auditoria."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" icon="x" onClick={() => onReject(reason)} disabled={reason.trim().length < 5}>Rejeitar</Button>
        </>
      }
    >
      <Field label="Motivo" required>
        <TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: material desatualizado, substituído pela versão 3 do POP." />
      </Field>
    </Modal>
  );
}
