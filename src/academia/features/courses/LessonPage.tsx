import { useEffect, useRef, useState } from "react";
import { catalogRepo, learningRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useRouter } from "../../router/Router";
import { useToast } from "../../state/ToastContext";
import { progressEngine } from "../../engines/learning/ProgressEngine";
import { xpEngine } from "../../engines/gamification/XpEngine";
import { competencyRepo } from "../../data/repositories";
import { Card } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { ProgressBar } from "../../ui/primitives/Progress";
import { EmptyState } from "../../ui/primitives/Feedback";
import { BlockList } from "../../ui/content/BlockRenderer";
import { SourceBadge } from "../../ui/primitives/SourceBadge";
import { Link } from "../../router/Router";
import { CharacterSpeech } from "../../ui/characters/Character";

/**
 * Player da aula. Experiência da seção 34: a aula termina com conquista,
 * convite para o próximo passo e, quando existe, um quiz rápido.
 */
export function LessonPage({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const { employee } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const startedAt = useRef(Date.now());
  const [finished, setFinished] = useState(false);

  const data = useQuery(() => {
    const course = catalogRepo.course(courseId);
    const lesson = catalogRepo.lesson(lessonId);
    if (!course || !lesson) return null;
    const lessons = catalogRepo.orderedLessons(courseId);
    const index = lessons.findIndex((l) => l.id === lessonId);
    const done = employee ? learningRepo.completedLessonIds(employee.id, courseId) : new Set<string>();
    const progressPct = lessons.length === 0 ? 0 : Math.round((lessons.filter((l) => done.has(l.id)).length / lessons.length) * 100);
    const quiz = lesson.quizId
      ? catalogRepo.quiz(lesson.quizId)
      : catalogRepo.quizzesOf("aula", lesson.id)[0];
    return {
      course,
      lesson,
      lessons,
      index,
      previous: lessons[index - 1],
      next: lessons[index + 1],
      alreadyDone: done.has(lesson.id),
      progressPct,
      quiz,
    };
  }, [courseId, lessonId, employee?.id, finished]);

  useEffect(() => {
    startedAt.current = Date.now();
    setFinished(false);
  }, [lessonId]);

  if (!data) return <EmptyState icon="book-open" title="Aula não encontrada" />;
  const { course, lesson, lessons, index, previous, next, alreadyDone, progressPct, quiz } = data;

  const complete = () => {
    if (!employee) return;
    const timeSpent = Math.round((Date.now() - startedAt.current) / 1000);
    const result = progressEngine.completeLesson(employee.id, lesson, timeSpent);
    setFinished(true);
    if (result.lessonXp > 0) toast.xp(result.lessonXp, `Aula: ${lesson.title}`);
    if (result.leveledUp) toast.levelUp(xpEngine.level(employee.id).name);
    toast.badges(result.newBadges);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Cabeçalho da aula */}
      <div className="mb-4">
        <Link to={`/curso/${course.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-600 hover:text-navy mb-2">
          <Icon name="arrow-left" size={15} />
          {course.title}
        </Link>
        <div className="flex items-center gap-2 text-[12px] text-ink-600 mb-2">
          <Chip tone="navy">Aula {index + 1} de {lessons.length}</Chip>
          <Chip tone="sand" icon="clock">{lesson.durationMin} min</Chip>
          <Chip tone="copper" icon="zap">+{lesson.xp} XP</Chip>
          {alreadyDone && <Chip tone="jade" icon="check">Concluída</Chip>}
        </div>
        <h1 className="text-[24px] sm:text-[28px] font-bold leading-tight">{lesson.title}</h1>
        <p className="text-[14.5px] text-ink-600 mt-1.5">{lesson.summary}</p>
        <div className="mt-3">
          <ProgressBar value={progressPct} size="sm" />
        </div>
      </div>

      {/* Conteúdo */}
      <Card className="p-4 sm:p-6">
        <BlockList blocks={lesson.blocks} />
      </Card>

      {/* Rastreabilidade */}
      {lesson.sourceRefs.length > 0 && (
        <div className="mt-3 card-quiet p-3.5">
          <div className="label mb-2">Origem do conteúdo desta aula</div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {lesson.sourceRefs.map((ref, i) => (
              <SourceBadge key={i} sourceRef={ref} label={ref.locator ? `${ref.contentId} · ${ref.locator}` : ref.contentId} />
            ))}
          </div>
        </div>
      )}

      {lesson.competencies.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-semibold text-ink-600 mr-1">Desenvolve:</span>
          {lesson.competencies.map((id) => (
            <Chip key={id} tone="navy">{competencyRepo.name(id)}</Chip>
          ))}
        </div>
      )}

      {/* Conclusão / próximos passos */}
      <div className="mt-6">
        {!alreadyDone && !finished ? (
          <Card className="p-4 sm:p-5 border-copper/30 bg-copper/5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <h3 className="font-bold text-[15px]">Terminou a aula?</h3>
                <p className="text-[13.5px] text-ink-600">Marque como concluída para ganhar {lesson.xp} XP e liberar o próximo passo.</p>
              </div>
              <Button size="lg" variant="copper" icon="check" onClick={complete}>Concluir aula</Button>
            </div>
          </Card>
        ) : (
          <Card className="p-4 sm:p-5 border-jade/30 bg-jade/5 animate-fade-up">
            <CharacterSpeech character="mestre" compact>
              {next
                ? "Boa! Fechou essa parte. Quer descobrir mais? A próxima aula continua de onde paramos."
                : quiz
                  ? "Você fechou o conteúdo. Agora mostre na prática: faça o quiz rápido."
                  : "Você concluiu todas as aulas deste curso. Hora da avaliação final."}
            </CharacterSpeech>
            <div className="mt-4 flex flex-wrap gap-2">
              {quiz && (
                <Button icon="clipboard" variant="primary" onClick={() => navigate(`/quiz/${quiz.id}?curso=${course.id}`)}>
                  Quiz rápido · +{quiz.xp} XP
                </Button>
              )}
              {next ? (
                <Button icon="arrow-right" variant={quiz ? "secondary" : "primary"} onClick={() => navigate(`/curso/${course.id}/aula/${next.id}`)}>
                  Próxima aula: {next.title.length > 28 ? `${next.title.slice(0, 28)}…` : next.title}
                </Button>
              ) : (
                <Button icon="clipboard" variant="copper" onClick={() => navigate(`/curso/${course.id}`)}>
                  Ir para a avaliação final
                </Button>
              )}
              <Button variant="ghost" onClick={() => navigate(`/curso/${course.id}`)}>Voltar ao curso</Button>
            </div>
          </Card>
        )}
      </div>

      {/* Navegação entre aulas */}
      <div className="mt-5 flex justify-between gap-3">
        <Button
          variant="secondary"
          icon="chevron-left"
          disabled={!previous}
          onClick={() => previous && navigate(`/curso/${course.id}/aula/${previous.id}`)}
        >
          Anterior
        </Button>
        <Button
          variant="secondary"
          iconRight="chevron-right"
          disabled={!next}
          onClick={() => next && navigate(`/curso/${course.id}/aula/${next.id}`)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
