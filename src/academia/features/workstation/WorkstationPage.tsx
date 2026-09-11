import { useState } from "react";
import { MACHINES, SYMPTOMS, workstationEngine } from "../../engines/learning/WorkstationEngine";
import { useQuery } from "../../state/useCollection";
import { useRouter } from "../../router/Router";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { SourceBadge } from "../../ui/primitives/SourceBadge";
import { CharacterSpeech } from "../../ui/characters/Character";
import { cn } from "../../core/cn";

/**
 * APRENDER NO POSTO (seção 27)
 * Acesso rápido, pensado para o celular no posto de trabalho: máquina →
 * sintoma → verificações educativas, com limite claro de segurança.
 */
export function WorkstationPage() {
  const { navigate } = useRouter();
  const [machine, setMachine] = useState<string | null>(null);
  const [symptom, setSymptom] = useState<string | null>(null);

  const guide = useQuery(
    () => (machine && symptom ? workstationEngine.guide(machine, symptom) : null),
    [machine, symptom],
  );

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Aprender no posto"
        subtitle="Estou com problema na máquina. O que verificar antes de chamar apoio?"
        icon="wrench"
      />

      <div className="mb-5">
        <CharacterSpeech character="mestre" compact>
          Escolha a máquina e o que está acontecendo. Vou te mostrar o que olhar primeiro — e quando parar e chamar a manutenção.
        </CharacterSpeech>
      </div>

      {/* Passo 1 — máquina */}
      <Card className="p-4 mb-4">
        <div className="label">1. Qual máquina?</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MACHINES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setMachine(option.id);
                setSymptom(null);
              }}
              className={cn(
                "px-3 py-3 rounded-xl border text-[14px] font-semibold transition-colors",
                machine === option.id ? "bg-navy text-linen-50 border-navy" : "bg-linen-50 border-sand hover:border-navy/40",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Passo 2 — sintoma */}
      {machine && (
        <Card className="p-4 mb-4 animate-fade-up">
          <div className="label">2. Qual o problema?</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {SYMPTOMS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSymptom(option.id)}
                className={cn(
                  "px-3.5 py-3 rounded-xl border text-left text-[14px] font-semibold transition-colors flex items-center gap-2",
                  symptom === option.id ? "bg-navy text-linen-50 border-navy" : "bg-linen-50 border-sand hover:border-navy/40",
                )}
              >
                {option.stopMachine && <Icon name="alert" size={15} className={symptom === option.id ? "" : "text-alert"} />}
                {option.label}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Resultado */}
      {guide && (
        <div className="space-y-4 animate-fade-up">
          <Card className={cn("p-4 sm:p-5", guide.stopMachine ? "border-alert/40 bg-alert/5" : "")}>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Chip tone="navy" icon="cpu">{guide.machine.label}</Chip>
              <Chip tone="copper">{guide.symptom.label}</Chip>
            </div>

            {guide.stopMachine ? (
              <div className="rounded-xl border-2 border-alert/40 bg-alert/10 p-4 flex gap-3">
                <Icon name="shield" size={22} className="text-alert shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[15px] text-alert">Pare a máquina e solicite apoio da manutenção</div>
                  <p className="text-[14px] mt-1 leading-relaxed">{guide.safetyMessage}</p>
                </div>
              </div>
            ) : guide.checks.length > 0 ? (
              <div>
                <h2 className="font-bold text-[16px] mb-3">Verificações educativas, nesta ordem</h2>
                <ol className="space-y-2.5">
                  {guide.checks.map((check, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="shrink-0 grid place-items-center w-7 h-7 rounded-lg bg-navy text-linen-50 text-[12px] font-bold">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-[14.5px] leading-relaxed">{check.step}</p>
                        <SourceBadge sourceRef={check.sourceRef} />
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : guide.notes.length > 0 ? (
              <div>
                <h2 className="font-bold text-[16px] mb-3">O que o material da casa diz sobre isso</h2>
                <ul className="space-y-3">
                  {guide.notes.map((note, i) => (
                    <li key={i}>
                      <p className="text-[14.5px] leading-relaxed">{note.text}</p>
                      <SourceBadge sourceRef={note.sourceRef} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[14px] text-ink-600">
                Ainda não temos material publicado sobre esse sintoma nesta máquina. Avise a coordenação de treinamento —
                quando o material entrar no Banco de Conhecimento, esta tela passa a responder.
              </p>
            )}

            {!guide.stopMachine && (
              <div className="mt-4 rounded-xl border border-sand bg-linen-100/60 p-3.5 flex gap-2.5">
                <Icon name="info" size={17} className="shrink-0 mt-0.5 text-ink-600" />
                <p className="text-[13.5px] leading-relaxed">{guide.safetyMessage}</p>
              </div>
            )}
          </Card>

          {guide.notes.length > 0 && guide.checks.length > 0 && (
            <Card className="p-4">
              <h3 className="font-bold text-[15px] mb-2">Por que isso acontece</h3>
              <ul className="space-y-3">
                {guide.notes.slice(0, 3).map((note, i) => (
                  <li key={i}>
                    <p className="text-[14px] leading-relaxed">{note.text}</p>
                    <SourceBadge sourceRef={note.sourceRef} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(guide.lessons.length > 0 || guide.games.length > 0 || guide.challenges.length > 0) && (
            <Card className="p-4">
              <h3 className="font-bold text-[15px] mb-3">Quer entender de verdade?</h3>
              <div className="space-y-2">
                {guide.lessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => navigate(`/curso/${lesson.courseId}/aula/${lesson.id}`)}
                    className="w-full text-left p-3 rounded-xl border border-sand bg-linen-50 hover:border-navy/40 flex items-center gap-3"
                  >
                    <Icon name="book-open" size={17} className="text-navy shrink-0" />
                    <span className="text-[14px] font-semibold flex-1 min-w-0 truncate">{lesson.title}</span>
                    <Chip tone="neutral">{lesson.durationMin} min</Chip>
                  </button>
                ))}
                {guide.games.map((game) => (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => navigate(`/jogos/${game.id}`)}
                    className="w-full text-left p-3 rounded-xl border border-sand bg-linen-50 hover:border-navy/40 flex items-center gap-3"
                  >
                    <Icon name="gamepad-2" size={17} className="text-copper shrink-0" />
                    <span className="text-[14px] font-semibold flex-1 min-w-0 truncate">{game.title}</span>
                    <Chip tone="copper">+{game.xp} XP</Chip>
                  </button>
                ))}
                {guide.challenges.map((challenge) => (
                  <button
                    key={challenge.id}
                    type="button"
                    onClick={() => navigate(`/desafio/${challenge.id}`)}
                    className="w-full text-left p-3 rounded-xl border border-sand bg-linen-50 hover:border-navy/40 flex items-center gap-3"
                  >
                    <Icon name="zap" size={17} className="text-copper shrink-0" />
                    <span className="text-[14px] font-semibold flex-1 min-w-0 truncate">{challenge.title}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Icon name="siren" size={18} className="text-alert" />
              <p className="text-[14px] flex-1">Se a situação envolve risco de acidente, registre.</p>
              <Button size="sm" variant="danger" onClick={() => navigate("/risco")}>Eu vi um risco</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
