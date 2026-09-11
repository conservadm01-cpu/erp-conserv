import { useEffect, useRef, useState } from "react";
import type { DiagnosisRound, GameDefinition, HotspotRound, SequenceRound, TimedQuizRound } from "../../core/types";
import { catalogRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useRouter } from "../../router/Router";
import { useToast } from "../../state/ToastContext";
import { gameEngine, type GameOutcome } from "../../engines/game/GameEngine";
import { nowIso } from "../../core/dates";
import { cn } from "../../core/cn";
import { Card } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { ProgressBar } from "../../ui/primitives/Progress";
import { EmptyState } from "../../ui/primitives/Feedback";
import { SourceBadge } from "../../ui/primitives/SourceBadge";
import { CharacterSpeech } from "../../ui/characters/Character";
import { GameScene } from "./scenes";

interface RoundResult {
  roundId: string;
  correct: boolean;
}

/** Hospeda qualquer jogo: escolhe o renderizador pela mecânica do payload. */
export function GameHostPage({ gameId }: { gameId: string }) {
  const { employee } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const game = useQuery(() => catalogRepo.game(gameId), [gameId]);
  const startedAt = useRef(nowIso());
  const [results, setResults] = useState<RoundResult[]>([]);
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);

  useEffect(() => {
    startedAt.current = nowIso();
    setResults([]);
    setOutcome(null);
  }, [gameId]);

  if (!game) return <EmptyState icon="gamepad-2" title="Jogo não encontrado" />;

  const finish = (finalResults: RoundResult[], scoreMax?: number) => {
    if (!employee) return;
    const result = gameEngine.finish(game, employee.id, finalResults, startedAt.current, scoreMax);
    setOutcome(result);
    toast.xp(result.xpEarned, `${game.title}: ${result.percent}%`);
    if (result.leveledUp) toast.levelUp("novo nível");
    toast.badges(result.newBadges);
  };

  if (outcome) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className={cn("p-6", outcome.passed ? "border-jade/40 bg-jade/5" : "border-copper/40 bg-copper/5")}>
          <div className="flex items-start gap-4">
            <span className={cn("shrink-0 grid place-items-center w-14 h-14 rounded-2xl text-linen-50", outcome.passed ? "bg-jade" : "bg-copper")}>
              <Icon name={outcome.passed ? "trophy" : "rotate"} size={28} />
            </span>
            <div>
              <h1 className="text-[24px] font-bold leading-tight">{outcome.passed ? "Muito bem!" : "Boa tentativa"}</h1>
              <p className="text-[15px] mt-1">
                {outcome.score} de {outcome.maxScore} ({outcome.percent}%)
              </p>
              <Chip tone="copper" icon="zap" className="mt-2">+{outcome.xpEarned} XP</Chip>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button icon="refresh" onClick={() => { setOutcome(null); setResults([]); startedAt.current = nowIso(); }}>Jogar novamente</Button>
            <Button variant="secondary" icon="gamepad-2" onClick={() => navigate("/jogos")}>Outros jogos</Button>
            {game.courseId && <Button variant="ghost" icon="book-open" onClick={() => navigate(`/curso/${game.courseId}`)}>Ver o curso</Button>}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4">
        <button type="button" onClick={() => navigate("/jogos")} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-600 hover:text-navy mb-2">
          <Icon name="arrow-left" size={15} />
          Jogos
        </button>
        <div className="flex items-start gap-3">
          <span className="shrink-0 grid place-items-center w-12 h-12 rounded-xl bg-navy text-linen-50">
            <Icon name={game.icon} size={24} />
          </span>
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-[26px] font-bold leading-tight">{game.title}</h1>
            <p className="text-[14px] text-ink-600 mt-0.5">{game.pitch}</p>
          </div>
        </div>
      </div>

      {game.payload.kind === "diagnosis" && (
        <DiagnosisRenderer game={game} rounds={game.payload.rounds} results={results} setResults={setResults} onFinish={finish} />
      )}
      {game.payload.kind === "sequence" && (
        <SequenceRenderer rounds={game.payload.rounds} onFinish={finish} />
      )}
      {game.payload.kind === "hotspot" && (
        <HotspotRenderer rounds={game.payload.rounds} onFinish={finish} />
      )}
      {game.payload.kind === "timed_quiz" && (
        <TimedQuizRenderer rounds={game.payload.rounds} onFinish={finish} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Mecânica 1 — Diagnóstico (Qual é o defeito? / Salve a máquina)
// ---------------------------------------------------------------------
function DiagnosisRenderer({ game, rounds, results, setResults, onFinish }: {
  game: GameDefinition;
  rounds: DiagnosisRound[];
  results: RoundResult[];
  setResults: (r: RoundResult[]) => void;
  onFinish: (results: RoundResult[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const round = rounds[index];
  if (!round) return null;
  const revealed = chosen !== null;

  const next = () => {
    const updated = [...results, { roundId: round.id, correct: chosen === round.correctOptionId }];
    setResults(updated);
    setChosen(null);
    if (index + 1 < rounds.length) setIndex(index + 1);
    else onFinish(updated);
  };

  return (
    <div>
      <ProgressBar value={(index / rounds.length) * 100} size="sm" />
      <Card className="p-4 sm:p-6 mt-4">
        <Chip tone="navy" className="mb-3">Situação {index + 1} de {rounds.length}</Chip>
        <CharacterSpeech character={game.character}>{round.situation}</CharacterSpeech>
        {round.hint && !revealed && (
          <p className="text-[13px] text-ink-600 mt-3 flex items-center gap-1.5">
            <Icon name="lightbulb" size={14} className="text-copper" />
            {round.hint}
          </p>
        )}
        <div className="mt-4 space-y-2">
          {round.options.map((option) => {
            const isCorrect = option.id === round.correctOptionId;
            const isChosen = option.id === chosen;
            return (
              <button
                key={option.id}
                type="button"
                disabled={revealed}
                onClick={() => setChosen(option.id)}
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
                <span>
                  <span className="font-semibold">{option.label}</span>
                  {option.description && <span className="block text-[13px] text-ink-600 mt-0.5">{option.description}</span>}
                </span>
              </button>
            );
          })}
        </div>

        {revealed && (
          <div className="mt-4 rounded-xl border border-sand bg-linen-100/70 p-4 animate-fade-up">
            <p className="text-[14.5px] leading-relaxed">{round.explanation}</p>
            {round.sourceId && <SourceBadge sourceId={round.sourceId} className="mt-2" />}
            <Button className="mt-3" icon={index + 1 < rounds.length ? "arrow-right" : "check"} onClick={next}>
              {index + 1 < rounds.length ? "Próxima situação" : "Ver resultado"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------
// Mecânica 2 — Sequência (Monte a camiseta)
// ---------------------------------------------------------------------
function SequenceRenderer({ rounds, onFinish }: { rounds: SequenceRound[]; onFinish: (r: RoundResult[], max?: number) => void }) {
  const [index, setIndex] = useState(0);
  const round = rounds[index];
  const [pool, setPool] = useState(() => shuffleItems(round?.items ?? []));
  const [chosen, setChosen] = useState<typeof pool>([]);
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<RoundResult[]>([]);

  useEffect(() => {
    setPool(shuffleItems(rounds[index]?.items ?? []));
    setChosen([]);
    setChecked(false);
  }, [index, rounds]);

  if (!round) return null;
  const totalItems = rounds.reduce((sum, r) => sum + r.items.length, 0);
  const correctCount = chosen.filter((item, i) => item.correctOrder === i + 1).length;

  const advance = () => {
    const roundResults: RoundResult[] = chosen.map((item, i) => ({
      roundId: `${round.id}-${item.id}`,
      correct: item.correctOrder === i + 1,
    }));
    const updated = [...results, ...roundResults];
    setResults(updated);
    if (index + 1 < rounds.length) setIndex(index + 1);
    else onFinish(updated, totalItems);
  };

  return (
    <div>
      <ProgressBar value={(index / rounds.length) * 100} size="sm" />
      <Card className="p-4 sm:p-6 mt-4">
        <Chip tone="navy" className="mb-3">Rodada {index + 1} de {rounds.length}</Chip>
        <h2 className="text-[16.5px] font-bold leading-snug">{round.instruction}</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="label">Toque na ordem certa</div>
            <div className="flex flex-wrap gap-2">
              {pool.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={checked}
                  onClick={() => {
                    setChosen([...chosen, item]);
                    setPool(pool.filter((p) => p.id !== item.id));
                  }}
                  className="px-3 py-2 rounded-xl border border-sand bg-linen-50 text-[14px] font-semibold hover:border-navy/40 hover:bg-navy/5 transition-colors flex items-center gap-1.5"
                >
                  {item.icon && <Icon name={item.icon} size={15} />}
                  {item.label}
                </button>
              ))}
              {pool.length === 0 && <p className="text-[13px] text-ink-400">Todas as etapas foram posicionadas.</p>}
            </div>
          </div>

          <div>
            <div className="label">Sua sequência</div>
            <ol className="space-y-2">
              {chosen.map((item, i) => {
                const ok = item.correctOrder === i + 1;
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-xl border text-[14px]",
                      !checked && "bg-linen-50 border-sand",
                      checked && ok && "bg-jade/10 border-jade/40",
                      checked && !ok && "bg-alert/8 border-alert/40",
                    )}
                  >
                    <span className="shrink-0 grid place-items-center w-6 h-6 rounded-lg bg-navy text-linen-50 text-[12px] font-bold">{i + 1}</span>
                    <span className="font-semibold flex-1">{item.label}</span>
                    {checked && <Icon name={ok ? "check" : "x"} size={16} className={ok ? "text-jade-600" : "text-alert"} />}
                    {!checked && (
                      <button
                        type="button"
                        aria-label={`Remover ${item.label}`}
                        onClick={() => {
                          setChosen(chosen.filter((c) => c.id !== item.id));
                          setPool([...pool, item]);
                        }}
                        className="text-ink-400 hover:text-alert"
                      >
                        <Icon name="x" size={15} />
                      </button>
                    )}
                  </li>
                );
              })}
              {chosen.length === 0 && <li className="text-[13px] text-ink-400">Comece tocando na primeira etapa.</li>}
            </ol>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 items-center">
          {!checked ? (
            <Button icon="check" disabled={pool.length > 0} onClick={() => setChecked(true)}>Conferir sequência</Button>
          ) : (
            <>
              <div className="flex-1 min-w-[200px]">
                <p className="text-[14px] font-semibold">
                  {correctCount} de {round.items.length} posições corretas
                </p>
                <p className="text-[13.5px] text-ink-600 leading-relaxed mt-0.5">{round.explanation}</p>
                {round.sourceId && <SourceBadge sourceId={round.sourceId} className="mt-1" />}
              </div>
              <Button icon={index + 1 < rounds.length ? "arrow-right" : "trophy"} onClick={advance}>
                {index + 1 < rounds.length ? "Próxima rodada" : "Ver resultado"}
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function shuffleItems<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------
// Mecânica 3 — Observação (Caça ao risco / Mestre da qualidade)
// ---------------------------------------------------------------------
function HotspotRenderer({ rounds, onFinish }: { rounds: HotspotRound[]; onFinish: (r: RoundResult[], max?: number) => void }) {
  const [index, setIndex] = useState(0);
  const [found, setFound] = useState<string[]>([]);
  const [misses, setMisses] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean; sourceId?: string } | null>(null);
  const [results, setResults] = useState<RoundResult[]>([]);
  const round = rounds[index];

  useEffect(() => {
    setFound([]);
    setMisses([]);
    setFeedback(null);
  }, [index]);

  if (!round) return null;
  const targets = round.spots.filter((s) => s.isTarget);
  const complete = found.length >= round.targetsToFind;
  const totalTargets = rounds.reduce((sum, r) => sum + r.targetsToFind, 0);

  const advance = () => {
    const roundResults: RoundResult[] = targets.map((spot) => ({ roundId: `${round.id}-${spot.id}`, correct: found.includes(spot.id) }));
    const updated = [...results, ...roundResults];
    setResults(updated);
    if (index + 1 < rounds.length) setIndex(index + 1);
    else onFinish(updated, totalTargets);
  };

  return (
    <div>
      <ProgressBar value={(index / rounds.length) * 100} size="sm" />
      <Card className="p-4 sm:p-5 mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <Chip tone="navy">Cena {index + 1} de {rounds.length}</Chip>
          <Chip tone={complete ? "jade" : "copper"} icon="search">
            {found.length} de {round.targetsToFind} encontrados
          </Chip>
        </div>
        <h2 className="text-[16.5px] font-bold leading-snug mb-3">{round.instruction}</h2>

        <div className="relative w-full rounded-xl overflow-hidden border border-sand bg-linen-100" style={{ aspectRatio: "1 / 1", maxWidth: 560, margin: "0 auto" }}>
          <GameScene name={round.scene} />
          {round.spots.map((spot) => {
            const isFound = found.includes(spot.id);
            const isMiss = misses.includes(spot.id);
            return (
              <button
                key={spot.id}
                type="button"
                aria-label={spot.label}
                onClick={() => {
                  if (complete) return;
                  setFeedback({ text: spot.feedback, ok: spot.isTarget, sourceId: spot.sourceId });
                  if (spot.isTarget && !isFound) setFound([...found, spot.id]);
                  else if (!spot.isTarget && !isMiss) setMisses([...misses, spot.id]);
                }}
                className={cn(
                  "absolute rounded-lg transition-all",
                  isFound && "ring-[3px] ring-jade bg-jade/25",
                  isMiss && "ring-2 ring-alert/60 bg-alert/10",
                  !isFound && !isMiss && "hover:bg-navy/10 hover:ring-2 hover:ring-navy/40",
                )}
                style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.w}%`, height: `${spot.h}%` }}
              >
                {isFound && <Icon name="check" size={16} className="text-jade-600" />}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div className={cn("mt-4 rounded-xl border p-3.5 animate-fade-up", feedback.ok ? "bg-jade/8 border-jade/30" : "bg-copper/8 border-copper/30")}>
            <div className="flex gap-2.5">
              <Icon name={feedback.ok ? "check-circle" : "info"} size={18} className={cn("shrink-0 mt-0.5", feedback.ok ? "text-jade-600" : "text-copper-600")} />
              <div>
                <p className="text-[14px] leading-relaxed">{feedback.text}</p>
                {feedback.sourceId && <SourceBadge sourceId={feedback.sourceId} className="mt-1" />}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 items-center">
          {complete ? (
            <>
              <p className="text-[14px] font-semibold text-jade-600 flex-1 min-w-[200px]">
                <Icon name="check-circle" size={16} className="inline mr-1" />
                Cena completa! {round.explanation}
              </p>
              <Button icon={index + 1 < rounds.length ? "arrow-right" : "trophy"} onClick={advance}>
                {index + 1 < rounds.length ? "Próxima cena" : "Ver resultado"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-[13px] text-ink-600 flex-1">Toque nos pontos da cena. Acertos ficam marcados em verde.</p>
              <Button variant="ghost" onClick={advance}>Desistir desta cena</Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------
// Mecânica 4 — Contra o tempo (Desafio dos 60 segundos)
// ---------------------------------------------------------------------
function TimedQuizRenderer({ rounds, onFinish }: { rounds: TimedQuizRound[]; onFinish: (r: RoundResult[], max?: number) => void }) {
  const round = rounds[0];
  const [started, setStarted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(round?.seconds ?? 60);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [flash, setFlash] = useState<"ok" | "erro" | null>(null);

  const questions = useQuery(() => {
    if (!round) return [];
    const fromBank = round.questionIds
      .map((id) => catalogRepo.question(id))
      .filter((q): q is NonNullable<typeof q> => !!q)
      .map((q) => ({
        id: q.id,
        stem: q.stem,
        options: q.options.map((o) => o.text),
        correctIndex: q.options.findIndex((o) => o.id === q.correctOptionId),
        explanation: q.explanation,
        sourceId: q.sourceRef.sourceId,
      }));
    const inline = round.inlineQuestions ?? [];
    return shuffleItems([...fromBank, ...inline]);
  }, [round?.id]);

  useEffect(() => {
    if (!started) return;
    if (secondsLeft <= 0) {
      onFinish(results, Math.max(results.length, 1));
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [started, secondsLeft, results, onFinish]);

  const current = questions[index];

  if (!round) return null;

  if (!started) {
    return (
      <Card className="p-6 text-center">
        <Icon name="timer" size={40} className="mx-auto text-copper" />
        <h2 className="text-[20px] font-bold mt-3">Pronto para {round.seconds} segundos?</h2>
        <p className="text-[14.5px] text-ink-600 mt-1.5 max-w-md mx-auto">
          Responda o máximo que conseguir. Errar não tira ponto — só avança para a próxima.
        </p>
        <Button size="lg" variant="copper" icon="play" className="mt-5" onClick={() => setStarted(true)}>Começar</Button>
      </Card>
    );
  }

  if (!current) {
    return (
      <Card className="p-6 text-center">
        <h2 className="text-[18px] font-bold">Acabaram as perguntas!</h2>
        <Button className="mt-4" icon="trophy" onClick={() => onFinish(results, Math.max(results.length, 1))}>Ver resultado</Button>
      </Card>
    );
  }

  const answer = (optionIndex: number) => {
    const correct = optionIndex === current.correctIndex;
    setFlash(correct ? "ok" : "erro");
    setResults([...results, { roundId: `${round.id}-${current.id}`, correct }]);
    window.setTimeout(() => {
      setFlash(null);
      setIndex((i) => i + 1);
    }, 450);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <Chip tone={secondsLeft <= 10 ? "alert" : "navy"} icon="timer">{secondsLeft}s</Chip>
        <Chip tone="jade" icon="check">{results.filter((r) => r.correct).length} acertos</Chip>
      </div>
      <ProgressBar value={(secondsLeft / round.seconds) * 100} tone={secondsLeft <= 10 ? "copper" : "navy"} size="sm" />
      <Card className={cn("p-4 sm:p-6 mt-4 transition-colors", flash === "ok" && "bg-jade/10 border-jade/40", flash === "erro" && "bg-alert/8 border-alert/40")}>
        <h2 className="text-[17px] font-bold leading-snug">{current.stem}</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {current.options.map((option, i) => (
            <button
              key={i}
              type="button"
              onClick={() => answer(i)}
              disabled={flash !== null}
              className="text-left px-4 py-3 rounded-xl border border-sand bg-linen-50 text-[14.5px] hover:border-navy/40 hover:bg-navy/5 transition-colors"
            >
              {option}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
