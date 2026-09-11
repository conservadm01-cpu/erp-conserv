import { catalogRepo, certificateRepo, competencyRepo, learningRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useRouter } from "../../router/Router";
import { progressEngine } from "../../engines/learning/ProgressEngine";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card, SectionTitle } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { ProgressBar } from "../../ui/primitives/Progress";
import { EmptyState, LegalNotice } from "../../ui/primitives/Feedback";
import { cn } from "../../core/cn";
import { formatDate } from "../../core/dates";
import { settingsRepo } from "../../data/repositories";

export function CoursePage({ courseId }: { courseId: string }) {
  const { employee } = useAuth();
  const { navigate } = useRouter();
  const settings = useQuery(() => settingsRepo.get());

  const data = useQuery(() => {
    const course = catalogRepo.course(courseId);
    if (!course) return null;
    const modules = catalogRepo.modulesOf(course.id).map((module) => ({
      module,
      lessons: catalogRepo.lessonsOfModule(module.id),
    }));
    const enrollment = employee ? learningRepo.enrollment(employee.id, course.id) : undefined;
    const done = employee ? learningRepo.completedLessonIds(employee.id, course.id) : new Set<string>();
    const next = employee ? progressEngine.nextLesson(employee.id, course.id) : undefined;
    const quiz = course.finalQuizId ? catalogRepo.quiz(course.finalQuizId) : undefined;
    const bestAttempt = employee && quiz ? learningRepo.bestAttempt(employee.id, quiz.id) : undefined;
    const certificate = employee ? certificateRepo.existing(employee.id, "curso", course.id) : undefined;
    const sources = course.librarySourceIds.map((id) => catalogRepo.source(id)).filter((s): s is NonNullable<typeof s> => !!s);
    const contents = course.sourceContentIds.map((id) => catalogRepo.content(id)).filter((c): c is NonNullable<typeof c> => !!c);
    const lessonsFinished = employee ? progressEngine.lessonsFinished(employee.id, course.id) : false;
    const handbook = course.handbookId ? catalogRepo.handbook(course.handbookId) : catalogRepo.handbooksOfCourse(course.id)[0];
    return { course, modules, enrollment, done, next, quiz, bestAttempt, certificate, sources, contents, lessonsFinished, handbook };
  }, [courseId, employee?.id]);

  if (!data) return <EmptyState icon="book-open" title="Curso não encontrado" />;
  const { course, modules, enrollment, done, next, quiz, bestAttempt, certificate, sources, contents, lessonsFinished, handbook } = data;
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);

  const start = () => {
    if (!employee) return;
    progressEngine.enroll(employee.id, course.id);
    const lesson = next ?? catalogRepo.orderedLessons(course.id)[0];
    if (lesson) navigate(`/curso/${course.id}/aula/${lesson.id}`);
  };

  return (
    <div>
      <PageHeader
        title={course.title}
        subtitle={course.subtitle}
        icon={course.icon}
        back={{ to: "/trilhas", label: "Trilhas" }}
      />

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <Card className="p-4 sm:p-5">
            <p className="text-[14.5px] leading-relaxed">{course.description}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <Chip tone="navy" icon="clock">{course.hours}h</Chip>
              <Chip tone="neutral" icon="book-open">{totalLessons} aulas</Chip>
              <Chip tone="sand">{course.level}</Chip>
              <Chip tone="neutral">{course.sector}</Chip>
              <Chip tone="jade" icon="target">Nota mínima {course.passScore}%</Chip>
            </div>
            {enrollment && (
              <div className="mt-4">
                <ProgressBar
                  value={enrollment.progressPct}
                  showValue
                  label={enrollment.status === "concluido" ? "Curso concluído" : "Seu progresso"}
                  tone={enrollment.status === "concluido" ? "jade" : "navy"}
                  size="lg"
                />
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="lg" icon="play" onClick={start}>
                {!enrollment ? "Começar curso" : next ? "Continuar de onde parei" : "Revisar aulas"}
              </Button>
              {handbook && (
                <Button size="lg" variant="secondary" icon="book-open" onClick={() => navigate(`/apostila/${handbook.id}`)}>
                  Apostila
                </Button>
              )}
            </div>
          </Card>

          <div>
            <SectionTitle hint="Cada módulo fecha um assunto. Dá para fazer em partes.">Conteúdo do curso</SectionTitle>
            <div className="space-y-3">
              {modules.map(({ module, lessons }) => {
                const moduleDone = lessons.every((l) => done.has(l.id)) && lessons.length > 0;
                return (
                  <Card key={module.id} className="overflow-hidden">
                    <div className={cn("px-4 py-3 border-b flex items-center gap-3", moduleDone ? "bg-jade/8 border-jade/20" : "bg-linen-100/70 border-sand/60")}>
                      <Icon name={moduleDone ? "check-circle" : "layers"} size={18} className={moduleDone ? "text-jade-600" : "text-ink-600"} />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-[14.5px] leading-snug">{module.title}</h3>
                        <p className="text-[12.5px] text-ink-600 truncate">{module.summary}</p>
                      </div>
                    </div>
                    <ul>
                      {lessons.map((lesson) => {
                        const isDone = done.has(lesson.id);
                        return (
                          <li key={lesson.id}>
                            <button
                              type="button"
                              onClick={() => navigate(`/curso/${course.id}/aula/${lesson.id}`)}
                              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-navy/5 transition-colors border-b border-sand/30 last:border-0"
                            >
                              <span className={cn(
                                "shrink-0 grid place-items-center w-7 h-7 rounded-lg border text-[12px] font-bold",
                                isDone ? "bg-jade/15 text-jade-600 border-jade/30" : "bg-linen-100 text-ink-600 border-sand",
                              )}>
                                {isDone ? <Icon name="check" size={14} /> : lesson.order}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[14px] font-semibold leading-snug">{lesson.title}</span>
                                <span className="block text-[12px] text-ink-600">{lesson.durationMin} min · {lesson.xp} XP</span>
                              </span>
                              <Icon name="chevron-right" size={17} className="shrink-0 text-ink-400" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                );
              })}
            </div>
          </div>

          {quiz && (
            <Card className={cn("p-4 sm:p-5", lessonsFinished ? "border-copper/40 bg-copper/5" : "")}>
              <div className="flex items-start gap-3">
                <span className="shrink-0 grid place-items-center w-11 h-11 rounded-xl bg-copper/15 text-copper-600 border border-copper/25">
                  <Icon name="clipboard" size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-[15.5px]">Avaliação final</h3>
                  <p className="text-[13.5px] text-ink-600 mt-0.5">
                    {quiz.drawCount || quiz.questionIds.length} questões sorteadas do banco aprovado ·
                    {" "}nota mínima {quiz.passScore}%
                    {quiz.timeLimitSec ? ` · ${Math.round(quiz.timeLimitSec / 60)} min` : ""}
                  </p>
                  {bestAttempt && (
                    <p className="text-[13px] mt-1.5">
                      <span className="font-semibold">Sua melhor nota:</span> {bestAttempt.score}%{" "}
                      {bestAttempt.passed ? <Chip tone="jade" className="ml-1">Aprovado</Chip> : <Chip tone="copper" className="ml-1">Tente novamente</Chip>}
                    </p>
                  )}
                  <div className="mt-3">
                    <Button
                      icon="play"
                      variant={lessonsFinished ? "copper" : "secondary"}
                      disabled={!lessonsFinished}
                      onClick={() => navigate(`/quiz/${quiz.id}?curso=${course.id}`)}
                    >
                      {bestAttempt ? "Refazer avaliação" : "Fazer avaliação"}
                    </Button>
                    {!lessonsFinished && (
                      <p className="text-[12.5px] text-ink-600 mt-2">
                        Conclua todas as aulas para liberar a avaliação ({done.size}/{totalLessons}).
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="space-y-4">
          {certificate && (
            <Card className="p-4 border-jade/30 bg-jade/5">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon name="award" size={18} className="text-jade-600" />
                <h3 className="font-bold text-[15px]">Certificado emitido</h3>
              </div>
              <p className="text-[13.5px]">Código <strong>{certificate.code}</strong> · {formatDate(certificate.issuedAt)}</p>
              <p className="text-[12px] text-ink-600 mt-1">{certificate.classification}</p>
              <Button size="sm" variant="secondary" className="mt-2.5" icon="award" onClick={() => navigate(`/certificado/${certificate.code}`)}>
                Ver certificado
              </Button>
            </Card>
          )}

          <Card className="p-4">
            <div className="label">Competências do curso</div>
            <div className="flex flex-wrap gap-1.5">
              {course.competencies.map((id) => (
                <Chip key={id} tone="navy">{competencyRepo.name(id)}</Chip>
              ))}
            </div>
          </Card>

          {contents.length > 0 && (
            <Card className="p-4">
              <div className="label">Material de origem</div>
              <ul className="space-y-2">
                {contents.map((content) => (
                  <li key={content.id} className="text-[13px]">
                    <span className="font-semibold text-navy-900">{content.title}</span>
                    <span className="text-ink-600"> · {content.id} v{content.version}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11.5px] text-ink-400 mt-2">
                Todo conteúdo deste curso tem origem rastreável no Banco de Conhecimento ConServ.
              </p>
            </Card>
          )}

          {sources.length > 0 && (
            <Card className="p-4">
              <div className="label">Referências</div>
              <ul className="space-y-2.5">
                {sources.map((source) => (
                  <li key={source.id} className="text-[13px]">
                    <div className="font-semibold text-navy-900 leading-snug">{source.name}</div>
                    <div className="text-ink-600">{source.institution} · {source.type}</div>
                    {source.url && (
                      <a href={source.url} target="_blank" rel="noreferrer" className="text-navy underline break-all text-[12px]">
                        {source.url}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {course.category === "seguranca" && <LegalNotice text={settings.legalDisclaimer} />}

          <Card className="p-4">
            <div className="label">Certificação</div>
            <p className="text-[13px] leading-relaxed">
              {course.certificate.enabled
                ? <>Ao concluir as aulas e atingir {course.passScore}% na avaliação, você recebe um <strong>{course.certificate.classification.toLowerCase()}</strong>, assinado por {course.certificate.responsible}.</>
                : "Este curso não emite certificado."}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
