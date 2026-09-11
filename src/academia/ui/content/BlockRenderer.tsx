import type { LessonBlock } from "../../core/types";
import { cn } from "../../core/cn";
import { Icon } from "../primitives/Icon";
import { SourceBadge } from "../primitives/SourceBadge";
import { CharacterSpeech } from "../characters/Character";
import { catalogRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";

// Renderiza os blocos de uma aula/apostila. O conteúdo vem do banco, então
// novas aulas aparecem sem tocar em código — é só combinar blocos.

function CuriosityBlock({ curiosityId }: { curiosityId: string }) {
  const curiosity = useQuery(() => catalogRepo.curiosity(curiosityId), [curiosityId]);
  if (!curiosity) return null;
  return (
    <div className="rounded-xl border border-copper/25 bg-copper/5 p-4">
      <div className="flex items-center gap-2 text-copper-600 text-[11px] font-bold uppercase tracking-wide mb-1">
        <Icon name="lightbulb" size={14} />
        Você sabia?
      </div>
      <div className="font-bold text-[14.5px]">{curiosity.title}</div>
      <p className="text-[14px] leading-relaxed mt-1">{curiosity.text}</p>
      <div className="mt-2">
        <SourceBadge sourceRef={curiosity.sourceRef} />
      </div>
    </div>
  );
}

export function BlockRenderer({ block, dense }: { block: LessonBlock; dense?: boolean }) {
  switch (block.kind) {
    case "heading":
      return <h3 className={cn("font-bold text-navy-900", dense ? "text-[16px] mt-2" : "text-[18px] mt-3")}>{block.text}</h3>;

    case "text":
      return (
        <div>
          <p className="text-[15.5px] leading-[1.72] text-ink">{block.text}</p>
          {block.sourceId && <SourceBadge sourceId={block.sourceId} className="mt-1" />}
        </div>
      );

    case "list":
      return (
        <div>
          {block.ordered ? (
            <ol className="space-y-1.5 list-decimal pl-5">
              {block.items.map((item, i) => (
                <li key={i} className="text-[15px] leading-relaxed">{item}</li>
              ))}
            </ol>
          ) : (
            <ul className="space-y-1.5">
              {block.items.map((item, i) => (
                <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed">
                  <span className="mt-[9px] shrink-0 w-1.5 h-1.5 rounded-full bg-copper" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
          {block.sourceId && <SourceBadge sourceId={block.sourceId} className="mt-1.5" />}
        </div>
      );

    case "callout": {
      const tone = {
        info: "bg-navy/5 border-navy/20",
        dica: "bg-jade/8 border-jade/25",
        alerta: "bg-copper/8 border-copper/25",
        atencao: "bg-alert/8 border-alert/25",
      }[block.tone];
      const icon = { info: "info", dica: "lightbulb", alerta: "alert", atencao: "alert" }[block.tone];
      return (
        <div className={cn("rounded-xl border p-4", tone)}>
          <div className="flex gap-2.5">
            <Icon name={icon} size={18} className="shrink-0 mt-0.5 text-ink-600" />
            <div className="min-w-0">
              {block.title && <div className="font-bold text-[14.5px] mb-0.5">{block.title}</div>}
              <p className="text-[14.5px] leading-relaxed">{block.text}</p>
              {block.sourceId && <SourceBadge sourceId={block.sourceId} className="mt-1.5" />}
            </div>
          </div>
        </div>
      );
    }

    case "character":
      return <CharacterSpeech character={block.character}>{block.text}</CharacterSpeech>;

    case "image":
      return (
        <figure>
          <img src={block.url} alt={block.alt} className="rounded-xl border border-sand w-full" />
          {block.caption && <figcaption className="text-[12.5px] text-ink-600 mt-1.5">{block.caption}</figcaption>}
        </figure>
      );

    case "video":
      return (
        <figure className="space-y-1.5">
          <div className="aspect-video rounded-xl border border-sand overflow-hidden bg-navy-900">
            <video src={block.url} controls className="w-full h-full" />
          </div>
          {block.caption && <figcaption className="text-[12.5px] text-ink-600">{block.caption}</figcaption>}
        </figure>
      );

    case "steps":
      return (
        <div className="rounded-xl border border-sand/70 bg-linen-100/60 p-4">
          {block.title && <div className="font-bold text-[14.5px] mb-2.5 flex items-center gap-2"><Icon name="list-ordered" size={16} />{block.title}</div>}
          <ol className="space-y-2.5">
            {block.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 grid place-items-center w-6 h-6 rounded-lg bg-navy text-linen-50 text-[12px] font-bold">{i + 1}</span>
                <span className="text-[14.5px] leading-relaxed pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          {block.sourceId && <SourceBadge sourceId={block.sourceId} className="mt-2.5" />}
        </div>
      );

    case "table":
      return (
        <div>
          <div className="overflow-x-auto rounded-xl border border-sand/70">
            <table className="w-full text-[13.5px] border-collapse">
              <thead>
                <tr className="bg-navy text-linen-50">
                  {block.headers.map((header, i) => (
                    <th key={i} className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "bg-linen-50" : "bg-linen-100/70"}>
                    {row.map((cell, ci) => (
                      <td key={ci} className={cn("px-3 py-2.5 align-top border-t border-sand/40", ci === 0 && "font-semibold text-navy-900")}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption && <p className="text-[12.5px] text-ink-600 mt-1.5">{block.caption}</p>}
          {block.sourceId && <SourceBadge sourceId={block.sourceId} className="mt-1" />}
        </div>
      );

    case "quote":
      return (
        <blockquote className="border-l-4 border-copper pl-4 py-1">
          <p className="text-[16px] italic leading-relaxed text-navy-900">“{block.text}”</p>
          {block.author && <footer className="text-[12.5px] text-ink-600 mt-1">— {block.author}</footer>}
        </blockquote>
      );

    case "curiosity":
      return <CuriosityBlock curiosityId={block.curiosityId} />;

    case "safety":
      return (
        <div className="rounded-xl border-2 border-alert/30 bg-alert/5 p-4 flex gap-3">
          <Icon name="shield" size={20} className="shrink-0 text-alert mt-0.5" />
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-alert mb-0.5">Segurança</div>
            <p className="text-[14.5px] leading-relaxed">{block.text}</p>
          </div>
        </div>
      );

    default:
      return null;
  }
}

export function BlockList({ blocks, className, dense }: { blocks: LessonBlock[]; className?: string; dense?: boolean }) {
  return (
    <div className={cn("space-y-4", className)}>
      {blocks.map((block, index) => (
        <BlockRenderer key={index} block={block} dense={dense} />
      ))}
    </div>
  );
}
