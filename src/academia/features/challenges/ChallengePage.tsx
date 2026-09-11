import { useState } from "react";
import { catalogRepo, learningRepo, settingsRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useRouter } from "../../router/Router";
import { useToast } from "../../state/ToastContext";
import { xpEngine } from "../../engines/gamification/XpEngine";
import { competencyEngine } from "../../engines/competency/CompetencyEngine";
import { quizEngine } from "../../engines/quiz/QuizEngine";
import { uid } from "../../core/ids";
import { nowIso } from "../../core/dates";
import { cn } from "../../core/cn";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card, SectionTitle } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { EmptyState } from "../../ui/primitives/Feedback";
import { SourceBadge } from "../../ui/primitives/SourceBadge";
import { CharacterSpeech } from "../../ui/characters/Character";
import { ChallengeList } from "./DailyChallenge";

export function ChallengePage({ challengeId }: { challengeId: string }) {
  const { employee } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const [chosen, setChosen] = useState<string | null>(null);
  const challenge = useQuery(() => catalogRepo.challenge(challengeId), [challengeId]);
  const xpRules = useQuery(() => settingsRepo.get().xpRules);

  if (!challenge) return <EmptyState icon="zap" title="Desafio não encontrado" />;
  const revealed = chosen !== null;
  const correct = chosen === challenge.correctOptionId;

  const answer = (optionId: string) => {
    if (!employee || revealed) return;
    const isCorrect = optionId === challenge.correctOptionId;
    setChosen(optionId);
    const amount = isCorrect ? challenge.xp || xpRules.challenge : Math.round((challenge.xp || xpRules.challenge) * 0.2);
    learningRepo.saveChallengeAttempt({
      id: uid("CAT"),
      challengeId: challenge.id,
      employeeId: employee.id,
      optionId,
      correct: isCorrect,
      at: nowIso(),
      xpEarned: amount,
      daily: false,
    });
    const award = xpEngine.award(employee.id, amount, `Desafio: ${challenge.title}`, "desafio", challenge.id);
    for (const competencyId of challenge.competencies) {
      competencyEngine.registerEvidence(employee.id, competencyId, "desafio", challenge.id, `Desafio: ${challenge.title}`, isCorrect ? 1 : 0.3);
    }
    toast.xp(amount, isCorrect ? "Decisão certa!" : "O importante é entender o porquê");
    if (award.leveledUp) toast.levelUp(award.level.name);
    toast.badges(award.newBadges);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title={challenge.title} subtitle={`Desafio prático · ${challenge.category}`} icon="zap" back={{ to: "/", label: "Início" }} />
      <Card className="p-4 sm:p-6">
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Chip tone="copper" icon="zap">+{challenge.xp} XP</Chip>
          <Chip tone="neutral">{challenge.difficulty}</Chip>
        </div>
        <CharacterSpeech character={challenge.character}>{challenge.scenario}</CharacterSpeech>
        <div className="mt-4 space-y-2">
          {challenge.options.map((option) => {
            const isCorrect = option.id === challenge.correctOptionId;
            const isChosen = option.id === chosen;
            return (
              <button
                key={option.id}
                type="button"
                disabled={revealed}
                onClick={() => answer(option.id)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl border text-[15px] leading-snug flex gap-3 items-start transition-colors",
                  !revealed && "bg-linen-50 border-sand hover:border-navy/40 hover:bg-navy/5",
                  revealed && isCorrect && "bg-jade/10 border-jade/40",
                  revealed && isChosen && !isCorrect && "bg-alert/8 border-alert/40",
                  revealed && !isCorrect && !isChosen && "bg-linen-100/60 border-sand/50 text-ink-600",
                )}
              >
                {revealed && (
                  <Icon name={isCorrect ? "check-circle" : isChosen ? "x" : "circle"} size={18}
                    className={cn("shrink-0 mt-0.5", isCorrect ? "text-jade-600" : isChosen ? "text-alert" : "text-ink-400")} />
                )}
                <span>{option.text}</span>
              </button>
            );
          })}
        </div>
        {revealed && (
          <div className={cn("mt-4 rounded-xl border p-4 animate-fade-up", correct ? "bg-jade/8 border-jade/30" : "bg-copper/8 border-copper/30")}>
            <p className="text-[14.5px] leading-relaxed">{challenge.explanation}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <SourceBadge sourceRef={challenge.sourceRef} label="Ver origem" />
              {challenge.courseId && (
                <Button size="sm" variant="secondary" icon="book-open" onClick={() => navigate(`/curso/${challenge.courseId}`)}>
                  Quer descobrir mais?
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Lista de desafios livres. */
export function ChallengesPage() {
  const challenges = useQuery(() => catalogRepo.publishedChallenges());
  return (
    <div>
      <PageHeader title="Desafios" subtitle="Situações reais da fábrica para treinar decisão." icon="zap" />
      <ChallengeList challenges={challenges} />
    </div>
  );
}

/**
 * APRENDER NOVAMENTE (seção 26): reforço dirigido por assunto, montado
 * com questões reais do banco + aulas e jogos relacionados.
 */
export function ReinforcementPage({ subject }: { subject: string }) {
  const { navigate } = useRouter();
  const data = useQuery(() => {
    const questions = catalogRepo.approvedQuestions().filter((q) => q.subject === subject);
    const competencyIds = [...new Set(questions.flatMap((q) => q.competencies))];
    const lessons = catalogRepo.publishedCourses()
      .flatMap((course) => catalogRepo.orderedLessons(course.id))
      .filter((lesson) => lesson.competencies.some((id) => competencyIds.includes(id)))
      .slice(0, 4);
    const games = catalogRepo.publishedGames().filter((game) => game.competencies.some((id) => competencyIds.includes(id))).slice(0, 3);
    return { questions, competencyIds, lessons, games };
  }, [subject]);

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title={`Reforçar: ${subject}`} subtitle="Revise o conteúdo e tente de novo. Sem pressa e sem punição." icon="rotate" back={{ to: "/", label: "Início" }} />

      <Card className="p-4 sm:p-5 mb-5">
        <CharacterSpeech character="mestre" compact>
          Ninguém aprende tudo de primeira. Vamos revisar e depois você testa de novo — só o que precisa.
        </CharacterSpeech>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            icon="clipboard"
            disabled={data.questions.length < 3}
            onClick={() => {
              const quiz = quizEngine.buildReinforcementQuiz(data.competencyIds, 6);
              if (quiz) navigate(`/quiz/${quiz.id}`);
            }}
          >
            Quiz de reforço ({Math.min(6, data.questions.length)} questões)
          </Button>
          {data.games[0] && (
            <Button variant="secondary" icon="gamepad-2" onClick={() => navigate(`/jogos/${data.games[0].id}`)}>
              Treinar jogando
            </Button>
          )}
        </div>
        {data.questions.length < 3 && (
          <p className="text-[12.5px] text-ink-600 mt-2">
            Ainda não há questões aprovadas suficientes sobre este assunto para montar um reforço.
          </p>
        )}
      </Card>

      {data.lessons.length > 0 && (
        <section>
          <SectionTitle hint="Revise antes de tentar novamente.">Aulas relacionadas</SectionTitle>
          <div className="space-y-2">
            {data.lessons.map((lesson) => (
              <Card key={lesson.id} className="p-3.5 flex items-center gap-3" interactive onClick={() => navigate(`/curso/${lesson.courseId}/aula/${lesson.id}`)}>
                <Icon name="book-open" size={18} className="text-navy shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold truncate">{lesson.title}</div>
                  <div className="text-[12px] text-ink-600 truncate">{lesson.summary}</div>
                </div>
                <Chip tone="neutral">{lesson.durationMin} min</Chip>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
