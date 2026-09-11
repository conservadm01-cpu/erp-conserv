import { catalogRepo, competencyRepo, learningRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useRouter } from "../../router/Router";
import { gameEngine, GAME_TYPE_LABELS } from "../../engines/game/GameEngine";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card, accentClasses } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { EmptyState } from "../../ui/primitives/Feedback";
import { CharacterSpeech } from "../../ui/characters/Character";
import { cn } from "../../core/cn";

export function GamesPage() {
  const { employee } = useAuth();
  const { navigate } = useRouter();

  const games = useQuery(() => catalogRepo.publishedGames().map((game) => ({
    game,
    best: employee ? learningRepo.bestGameScore(employee.id, game.id) : undefined,
    mechanic: gameEngine.mechanicOf(game),
    maxScore: gameEngine.maxScore(game),
  })), [employee?.id]);

  return (
    <div>
      <PageHeader
        title="Jogos"
        subtitle="Aprender praticando: situações reais da fábrica em formato de jogo."
        icon="gamepad-2"
      />

      <div className="mb-5">
        <CharacterSpeech character="mestre">
          Jogo aqui não é brincadeira solta: cada rodada vem de um material técnico da casa. Errar no jogo é bem mais
          barato que errar no lote.
        </CharacterSpeech>
      </div>

      {games.length === 0 ? (
        <EmptyState icon="gamepad-2" title="Nenhum jogo publicado" description="Os jogos aparecem aqui assim que a coordenação publicar." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {games.map(({ game, best, mechanic, maxScore }) => (
            <Card key={game.id} className="p-4 flex flex-col" interactive onClick={() => navigate(`/jogos/${game.id}`)}>
              <div className="flex items-start gap-3">
                <span className={cn("shrink-0 grid place-items-center w-11 h-11 rounded-xl border", accentClasses(game.accent))}>
                  <Icon name={game.icon} size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-[15px] leading-snug">{game.title}</h3>
                  <p className="text-[12.5px] text-ink-600 mt-0.5">{GAME_TYPE_LABELS[game.type]} · {mechanic.label}</p>
                </div>
              </div>
              <p className="text-[13.5px] text-ink-600 mt-2.5 leading-snug flex-1">{game.pitch}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <Chip tone="copper" icon="zap">+{game.xp} XP</Chip>
                <Chip tone="neutral">{maxScore} pontos</Chip>
                {game.aiGenerated && <Chip tone="sand" icon="sparkles">gerado de material</Chip>}
              </div>
              {best && (
                <p className="text-[12px] text-ink-600 mt-2">
                  Seu recorde: <strong>{best.score}/{best.maxScore}</strong>
                  {best.passed && <Chip tone="jade" className="ml-1.5">aprovado</Chip>}
                </p>
              )}
              {game.competencies.length > 0 && (
                <p className="text-[11.5px] text-ink-400 mt-2 truncate">
                  {game.competencies.slice(0, 3).map((id) => competencyRepo.name(id)).join(" · ")}
                </p>
              )}
              <Button size="sm" icon="play" className="mt-3">Jogar</Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
