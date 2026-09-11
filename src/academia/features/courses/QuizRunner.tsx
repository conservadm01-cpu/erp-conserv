import { useEffect, useMemo, useRef, useState } from "react";
import type { Question } from "../../core/types";
import { catalogRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useRouter } from "../../router/Router";
import { useToast } from "../../state/ToastContext";
import { quizEngine, type PreparedQuiz, type QuizResult } from "../../engines/quiz/QuizEngine";
import { progressEngine } from "../../engines/learning/ProgressEngine";
import { Card } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { ProgressBar } from "../../ui/primitives/Progress";
import { EmptyState } from "../../ui/primitives/Feedback";
import { SourceBadge } from "../../ui/primitives/SourceBadge";
import { CharacterSpeech } from "../../ui/characters/Character";
import { cn } from "../../core/cn";
import { formatDuration } from "../../core/dates";

interface Answer {
  questionId: string;
  optionId: string | null;
  timeSec: number;
}

export function QuizRunnerPage({ quizId, courseId }: { quizId: string; courseId?: string }) {
  const { employee } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const [prepared, setPrepared] = useState<PreparedQuiz | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const questionStart = useRef(Date.now());
  // Trava contra envio duplicado: sem ela, o efeito do cronômetro podia
  // chamar submit() de novo antes do estado `result` ser commitado,
  // gravando duas tentativas e lançando XP duas vezes.
  const enviado = useRef(false);

  const quiz = useQuery(() => catalogRepo.quiz(quizId), [quizId]);

  useEffect(() => {
    const ready = quizEngine.prepare(quizId);
    setPrepared(ready);
    setIndex(0);
    setAnswers([]);
    setResult(null);
    enviado.current = false;
    setSecondsLeft(ready?.quiz.timeLimitSec ?? null);
    questionStart.current = Date.now();
  }, [quizId]);

  useEffect(() => {
    if (secondsLeft === null || result) return;
    if (secondsLeft <= 0) {
      submit();
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft, result]);

  const current = prepared?.questions[index];
  const answered = useMemo(() => new Map(answers.map((a) => [a.questionId, a])), [answers]);

  if (!quiz) return <EmptyState icon="clipboard" title="Quiz não encontrado" />;
  if (!prepared || prepared.questions.length === 0) {
    return (
      <EmptyState
        icon="clipboard"
        title="Sem questões aprovadas"
        description="Este quiz ainda não tem questões aprovadas no banco. Um administrador precisa aprovar as questões geradas a partir do material."
      />
    );
  }

  function choose(optionId: string) {
    if (!current) return;
    const timeSec = Math.max(1, Math.round((Date.now() - questionStart.current) / 1000));
    setAnswers((list) => [...list.filter((a) => a.questionId !== current.id), { questionId: current.id, optionId, timeSec }]);
  }

  function goNext() {
    if (!prepared) return;
    questionStart.current = Date.now();
    if (index + 1 < prepared.questions.length) setIndex(index + 1);
    else submit();
  }

  function submit() {
    if (!prepared || !employee || result || enviado.current) return;
    enviado.current = true;
    const complete = prepared.questions.map((q) => answered.get(q.id) ?? { questionId: q.id, optionId: null, timeSec: 0 });
    const outcome = quizEngine.submit(prepared, employee.id, complete, courseId);
    setResult(outcome);
    toast.xp(outcome.xpEarned, `${outcome.correctCount} de ${outcome.total} certas`);
    if (outcome.leveledUp) toast.levelUp("novo nível");
    toast.badges(outcome.newBadges);

    // Avaliação final aprovada fecha o curso e emite certificado.
    if (prepared.quiz.scope === "avaliacao_final" && courseId) {
      const completion = progressEngine.completeCourse(employee.id, courseId, outcome.score);
      if (completion.certificate) {
        toast.success("Certificado emitido!", `Código ${completion.certificate.code}`);
        toast.badges(completion.newBadges);
      }
    }
  }

  // ---------------- Resultado ----------------
  if (result) {
    const passed = result.passed;
    return (
      <div className="max-w-3xl mx-auto">
        <Card className={cn("p-5 sm:p-6 mb-5", passed ? "border-jade/40 bg-jade/5" : "border-copper/40 bg-copper/5")}>
          <div className="flex items-start gap-4">
            <span className={cn("shrink-0 grid place-items-center w-14 h-14 rounded-2xl", passed ? "bg-jade text-linen-50" : "bg-copper text-linen-50")}>
              <Icon name={passed ? "trophy" : "rotate"} size={28} />
            </span>
            <div className="min-w-0">
              <h1 className="text-[22px] sm:text-[26px] font-bold leading-tight">
                {passed ? "Aprovado!" : "Quase lá"}
              </h1>
              <p className="text-[15px] mt-1">
                Você acertou <strong>{result.correctCount} de {result.total}</strong> — nota <strong>{result.score}%</strong>
                {" "}(mínimo {prepared.quiz.passScore}%).
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                <Chip tone="copper" icon="zap">+{result.xpEarned} XP</Chip>
                <Chip tone="neutral" icon="clock">{formatDuration(result.attempt.durationSec)}</Chip>
              </div>
            </div>
          </div>

          {result.weakSubjects.length > 0 && (
            <div className="mt-5">
              <CharacterSpeech character="mestre" compact>
                {passed
                  ? `Bom resultado. Mesmo assim, vale reforçar: ${result.weakSubjects.slice(0, 2).join(" e ")}.`
                  : `Não tem problema. O que precisa reforçar é claro: ${result.weakSubjects.slice(0, 2).join(" e ")}. Vamos de novo?`}
              </CharacterSpeech>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.weakCompetencies.length > 0 && (
                  <Button
                    variant="copper"
                    icon="rotate"
                    onClick={() => {
                      const reinforcement = quizEngine.buildReinforcementQuiz(result.weakCompetencies, 6);
                      if (reinforcement) navigate(`/quiz/${reinforcement.id}`);
                    }}
                  >
                    Aprender novamente
                  </Button>
                )}
                <Button variant="secondary" icon="refresh" onClick={() => window.location.reload()}>Refazer este quiz</Button>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {courseId && <Button variant="secondary" icon="book-open" onClick={() => navigate(`/curso/${courseId}`)}>Voltar ao curso</Button>}
            <Button variant="ghost" icon="home" onClick={() => navigate("/")}>Ir para o início</Button>
          </div>
        </Card>

        <h2 className="text-[16px] font-bold mb-3">Revisão das questões</h2>
        <div className="space-y-3">
          {result.review.map((item, i) => (
            <QuestionReview key={item.question.id} question={item.question} chosenOptionId={item.chosenOptionId} correct={item.correct} number={i + 1} />
          ))}
        </div>
      </div>
    );
  }

  // ---------------- Execução ----------------
  const selected = current ? answered.get(current.id)?.optionId ?? null : null;
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h1 className="text-[18px] sm:text-[22px] font-bold leading-tight truncate">{quiz.title}</h1>
          <p className="text-[12.5px] text-ink-600">Questão {index + 1} de {prepared.questions.length}</p>
        </div>
        {secondsLeft !== null && (
          <Chip tone={secondsLeft < 60 ? "alert" : "navy"} icon="timer">
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
          </Chip>
        )}
      </div>
      <ProgressBar value={((index) / prepared.questions.length) * 100} size="sm" />

      {current && (
        <Card className="p-4 sm:p-6 mt-4">
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Chip tone="sand">{current.subject}</Chip>
            <Chip tone="neutral">{current.difficulty}</Chip>
            <Chip tone="navy">{current.type.replace(/_/g, " ")}</Chip>
          </div>
          <h2 className="text-[17px] sm:text-[19px] font-bold leading-snug">{current.stem}</h2>
          <div className="mt-4 space-y-2">
            {current.shuffledOptions.map((option, i) => (
              <button
                key={option.id}
                type="button"
                onClick={() => choose(option.id)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl border text-[15px] leading-snug flex gap-3 items-start transition-colors",
                  selected === option.id
                    ? "bg-navy text-linen-50 border-navy"
                    : "bg-linen-50 border-sand hover:border-navy/40 hover:bg-navy/5",
                )}
              >
                <span className={cn(
                  "shrink-0 grid place-items-center w-6 h-6 rounded-lg text-[12px] font-bold",
                  selected === option.id ? "bg-linen-50/20" : "bg-sand/30 text-ink-600",
                )}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span>{option.text}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} icon="chevron-left">
              Anterior
            </Button>
            <Button
              variant={index + 1 === prepared.questions.length ? "copper" : "primary"}
              iconRight={index + 1 === prepared.questions.length ? undefined : "chevron-right"}
              icon={index + 1 === prepared.questions.length ? "check" : undefined}
              onClick={goNext}
              disabled={!selected}
            >
              {index + 1 === prepared.questions.length ? "Finalizar" : "Próxima"}
            </Button>
          </div>
          <p className="text-[12px] text-ink-400 mt-3">
            {answers.length} de {prepared.questions.length} respondidas. Você pode voltar e mudar antes de finalizar.
          </p>
        </Card>
      )}
    </div>
  );
}

export function QuestionReview({ question, chosenOptionId, correct, number }: {
  question: Question;
  chosenOptionId: string | null;
  correct: boolean;
  number: number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className={cn(
          "shrink-0 grid place-items-center w-7 h-7 rounded-lg text-[12px] font-bold",
          correct ? "bg-jade/15 text-jade-600" : "bg-alert/10 text-alert",
        )}>
          {correct ? <Icon name="check" size={15} /> : <Icon name="x" size={15} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold leading-snug">{number}. {question.stem}</p>
          <ul className="mt-2 space-y-1">
            {question.options.map((option) => {
              const isCorrect = option.id === question.correctOptionId;
              const isChosen = option.id === chosenOptionId;
              return (
                <li
                  key={option.id}
                  className={cn(
                    "text-[13.5px] px-3 py-1.5 rounded-lg border flex gap-2 items-start",
                    isCorrect && "bg-jade/8 border-jade/30 font-semibold",
                    isChosen && !isCorrect && "bg-alert/8 border-alert/30",
                    !isCorrect && !isChosen && "border-transparent",
                  )}
                >
                  {isCorrect && <Icon name="check" size={14} className="shrink-0 mt-0.5 text-jade-600" />}
                  {isChosen && !isCorrect && <Icon name="x" size={14} className="shrink-0 mt-0.5 text-alert" />}
                  <span>{option.text}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-2.5 rounded-lg bg-linen-100/70 border border-sand/50 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-600 mb-0.5">Por quê</div>
            <p className="text-[13.5px] leading-relaxed">{question.explanation}</p>
            <div className="mt-1.5">
              <SourceBadge sourceRef={question.sourceRef} label="Ver trecho de origem" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
