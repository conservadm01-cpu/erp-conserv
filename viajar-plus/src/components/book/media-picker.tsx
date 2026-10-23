"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MediaThumb } from "@/components/media/media-thumb";
import type { MediaAsset } from "@/lib/types";
import { cn } from "@/lib/cn";

export function MediaPicker({ open, onClose, media, onPick, multiple = true, title = "Escolher fotos" }: { open: boolean; onClose: () => void; media: MediaAsset[]; onPick: (ids: string[]) => void; multiple?: boolean; title?: string }) {
  const [sel, setSel] = useState<string[]>([]);
  const [onlyFav, setOnlyFav] = useState(false);
  const photos = media.filter((m) => m.kind === "image" && (!onlyFav || m.favorite || m.instagrammable));
  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()} size="lg" title={title} description={multiple ? "Selecione uma ou mais fotos." : "Selecione uma foto."}>
      <div className="mb-3 flex items-center gap-2">
        <Button size="sm" variant={onlyFav ? "primary" : "outline"} aria-pressed={onlyFav} onClick={() => setOnlyFav(!onlyFav)}>
          Só favoritas/instagramáveis
        </Button>
        <span className="ml-auto text-sm text-muted">{sel.length} selecionada(s)</span>
      </div>
      {!photos.length ? (
        <p className="py-8 text-center text-sm text-muted">Nenhuma foto disponível. Envie fotos em “Fotos e vídeos”.</p>
      ) : (
        <ul className="grid max-h-[55dvh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
          {photos.map((m) => {
            const on = sel.includes(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={m.caption || m.original_name}
                  className={cn("relative block w-full overflow-hidden rounded-lg ring-offset-2", on && "ring-2 ring-accent")}
                  onClick={() => setSel(multiple ? (on ? sel.filter((x) => x !== m.id) : [...sel, m.id]) : [m.id])}
                >
                  <MediaThumb asset={m} className="aspect-square w-full" />
                  {on && <Check className="absolute right-1 top-1 h-5 w-5 rounded-full bg-accent p-0.5 text-accent-fg" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={!sel.length}
          onClick={() => {
            onPick(sel);
            setSel([]);
            onClose();
          }}
        >
          Adicionar
        </Button>
      </div>
    </Modal>
  );
}
