import { useState } from "react";
import type { SourceRef } from "../../core/types";
import { catalogRepo } from "../../data/repositories";
import { parseSourceId } from "../../core/ids";
import { useQuery } from "../../state/useCollection";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { Chip } from "./Chip";
import { cn } from "../../core/cn";

/**
 * Mostra a rastreabilidade de uma informação (seção 24): de qual material
 * e de qual trecho ela veio. Clicar abre o trecho literal.
 */
export function SourceBadge({ sourceId, sourceRef, label = "Fonte", className }: {
  sourceId?: string;
  sourceRef?: SourceRef;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = sourceRef?.sourceId ?? sourceId;
  const resolved = useQuery(() => {
    if (!id) return null;
    const parsed = parseSourceId(id);
    if (!parsed) return null;
    const content = catalogRepo.content(parsed.contentId);
    const chunk = content?.chunks[parsed.chunkIndex];
    const library = (sourceRef?.librarySourceId ?? content?.librarySourceIds[0])
      ? catalogRepo.source(sourceRef?.librarySourceId ?? content?.librarySourceIds[0])
      : undefined;
    return { content, chunk, library, parsed };
  }, [id]);

  if (!id) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-semibold text-ink-400 hover:text-navy transition-colors",
          className,
        )}
        title={`Ver origem da informação (${id})`}
      >
        <Icon name="file" size={12} />
        {label}
        {sourceRef?.uncertain && <Icon name="alert" size={12} className="text-copper" />}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="De onde veio esta informação" subtitle={id}>
        <div className="space-y-4">
          {resolved?.content ? (
            <div className="card-quiet p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Chip tone="navy" icon="file">{resolved.content.id} · v{resolved.content.version}</Chip>
                <Chip tone="sand">{resolved.content.contentType}</Chip>
                {resolved.chunk?.locator && <Chip tone="neutral">{resolved.chunk.locator}</Chip>}
              </div>
              <h4 className="font-bold text-[15px]">{resolved.content.title}</h4>
              <p className="text-[13px] text-ink-600 mt-1">{resolved.content.description}</p>
            </div>
          ) : (
            <p className="text-[14px] text-ink-600">Material de origem não encontrado no Banco de Conhecimento (pode ter sido arquivado).</p>
          )}

          <div>
            <div className="label">Trecho de origem</div>
            <blockquote className="border-l-4 border-sand bg-linen-100/70 rounded-r-lg p-3.5 text-[14px] leading-relaxed italic text-ink">
              “{resolved?.chunk?.text ?? sourceRef?.excerpt ?? "Trecho não disponível."}”
            </blockquote>
          </div>

          {resolved?.library && (
            <div>
              <div className="label">Fonte de referência</div>
              <p className="text-[14px]">
                <strong>{resolved.library.name}</strong>
                <span className="text-ink-600"> — {resolved.library.institution} ({resolved.library.type})</span>
              </p>
              {resolved.library.url && (
                <a href={resolved.library.url} target="_blank" rel="noreferrer" className="text-[13px] text-navy underline break-all">
                  {resolved.library.url}
                </a>
              )}
            </div>
          )}

          {sourceRef?.uncertain && (
            <div className="rounded-xl border border-copper/30 bg-copper/5 p-3.5 text-[13.5px] text-copper-600">
              <strong>Conteúdo marcado como incerto.</strong> Foi gerado por interpretação do material e precisa de conferência humana antes de ser tratado como padrão da empresa.
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
