import { useMemo, useState } from "react";
import type { Challenge } from "../../core/types";
import { catalogRepo, learningRepo, settingsRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../state/ToastContext";
import { xpEngine } from "../../engines/gamification/XpEngine";
import { competencyEngine } from "../../engines/competency/CompetencyEngine";
import { uid } from "../../core/ids";
import { dayKey, nowIso } from "../../core/dates";
import { cn } from "../../core/cn";
import { Card } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { CharacterSpeech } from "../../ui/characters/Character";
import { SourceBadge } from "../../ui/primitives/SourceBadge";

/** Escolhe o desafio do dia de forma estável (mesmo desafio o dia inteiro). */
function pickDaily(pool: Challenge[], attempted: Set<string>, key: string): Challenge | undefined {
  const fresh = pool.filter((c) => !attempted.has(c.id));
  const list = fresh.length > 0 ? fresh : pool;
  if (list.length === 0) return undefined;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 100000;
  return list[hash % list.length];
}

export function DailyChallengeCard({ compact }: { compact?: boolean }) {
  const { employee } = useAuth();
  const toast = useToast();
  const [chosen, setChosen] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);

  const data = useQuery(() => {
    if (!employee) return null;
    const pool = catalogRepo.dailyChallenges();
    const attempted = learningRepo.attemptedChallengeIds(employee.id);
    const today = learningRepo.dailyAttemptToday(employee.id);
    const challenge = today ? catalogRepo.challenge(today.challengeId) : pickDaily(pool, attempted, `${dayKey()}-${employee.id}`);
    return { challenge, alreadyDone: !!today, previous: today };
  }, [employee?.id, answered]);

  const challenge = data?.challenge;
  const done = answered || !!data?.alreadyDone;
  const correctId = challenge?.correctOptionId;
  const selected = chosen ?? data?.previous?.optionId ?? null;

  const xpRules = useQuery(() => settingsRepo.get().xpRules);

  const result = useMemo(() => {
    if (!done || !challenge || !selected) return null;
    return { correct: selected === challenge.correctOptionId };
  }, [done, challenge, selected]);

  if (!employee || !challenge) return null;

  const answer = (optionId: string) => {
    if (done) return;
    const correct = optionId === challenge.correctOptionId;
    setChosen(optionId);
    setAnswered(true);
    learningRepo.saveChallengeAttempt({
      id: uid("CAT"),
      challengeId: challenge.id,
      employeeId: employee.id,
      optionId,
      correct,
      at: nowIso(),
      xpEarned: correct ? challenge.xp || xpRules.challenge : Math.round((challenge.xp || xpRules.challenge) * 0.2),
      daily: true,
    });
    const amount = correct ? challenge.xp || xpRules.challenge : Math.round((challenge.xp || xpRules.challenge) * 0.2);
    const award = xpEngine.award(employee.id, amount, `Desafio do dia: ${challenge.title}`, "desafio", challenge.id);
    for (const competencyId of challenge.competencies) {
      competencyEngine.registerEvidence(employee.id, competencyId, "desafio", challenge.id, `Desafio: ${challenge.title}`, correct ? 1 : 0.3);
    }
    toast.xp(amount, correct ? "Resposta certa!" : "Valeu por tentar — o importante é entender");
    if (award.leveledUp) toast.levelUp(award.level.name);
    toast.badges(award.newBadges);
  };

  return (
    <Card className={cn("overflow-hidden", compact && "text-[14px]")}>
      <div className="bg-copper/10 border-b border-copper/20 px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-copper-600">
          <Icon name="zap" size={18} />
          <span className="font-bold text-[13px] uppercase tracking-wide">Desafio do dia</span>
        </div>
        <Chip tone="copper">+{challenge.xp} XP</Chip>
      </div>
      <div className="p-4 sm:p-5 space-y-4">
        <CharacterSpeech character={challenge.character}>{challenge.scenario}</CharacterSpeech>

        <div className="space-y-2">
          {challenge.options.map((option) => {
            const isSelected = selected === option.id;
            const isCorrect = option.id === correctId;
            const reveal = done;
            return (
              <button
                key={option.id}
                type="button"
                disabled={done}
                onClick={() => answer(option.id)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl border text-[14.5px] leading-snug transition-colors flex gap-3 items-start",
                  !reveal && "bg-linen-50 border-sand hover:border-navy/40 hover:bg-navy/5",
                  reveal && isCorrect && "bg-jade/10 border-jade/40",
                  reveal && isSelected && !isCorrect && "bg-alert/8 border-alert/40",
                  reveal && !isCorrect && !isSelected && "bg-linen-100/60 border-sand/50 text-ink-600",
                )}
              >
                {reveal && (
                  <Icon
                    name={isCorrect ? "check-circle" : isSelected ? "x" : "circle"}
                    size={18}
                    className={cn("shrink-0 mt-0.5", isCorrect ? "text-jade-600" : isSelected ? "text-alert" : "text-ink-400")}
                  />
                )}
                <span>{option.text}</span>
              </button>
            );
          })}
        </div>

        {done && (
          <div className={cn("rounded-xl border p-4 animate-fade-up", result?.correct ? "bg-jade/8 border-jade/30" : "bg-copper/8 border-copper/30")}>
            <div className="font-bold text-[14.5px] mb-1 flex items-center gap-2">
              <Icon name={result?.correct ? "check-circle" : "lightbulb"} size={17} />
              {result?.correct ? "Muito bem! Você percebeu o problema antes que ele virasse retrabalho." : "Vamos entender juntos"}
            </div>
            <p className="text-[14.5px] leading-relaxed">{challenge.explanation}</p>
            <div className="mt-2 flex items-center gap-3">
              <SourceBadge sourceRef={challenge.sourceRef} label="Ver origem" />
              {challenge.courseId && (
                <a href={`#/curso/${challenge.courseId}`} className="text-[12px] font-semibold text-navy underline">
                  Quer descobrir mais? Ver o curso
                </a>
              )}
            </div>
          </div>
        )}

        {!done && (
          <p className="text-[12.5px] text-ink-400">Escolha uma opção — não existe punição por errar, só aprendizado.</p>
        )}
      </div>
    </Card>
  );
}

/** Lista de desafios livres (fora do desafio do dia). */
export function ChallengeList({ challenges }: { challenges: Challenge[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {challenges.map((challenge) => (
        <Card key={challenge.id} className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-bold text-[14.5px]">{challenge.title}</h3>
            <Chip tone="copper">+{challenge.xp} XP</Chip>
          </div>
          <p className="text-[13.5px] text-ink-600 leading-snug line-clamp-3">{challenge.scenario}</p>
          <div className="mt-3 flex items-center gap-2">
            <Chip tone="sand">{challenge.category}</Chip>
            <Chip tone="neutral">{challenge.difficulty}</Chip>
          </div>
          <Button variant="secondary" size="sm" className="mt-3" icon="play" onClick={() => { window.location.hash = `/desafio/${challenge.id}`; }}>
            Responder
          </Button>
        </Card>
      ))}
    </div>
  );
}
