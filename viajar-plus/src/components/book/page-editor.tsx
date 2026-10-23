"use client";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { getRepo } from "@/lib/data";
import { FRAME_TEMPLATES } from "@/lib/photo/frames";
import type { AlbumPage, AlbumPageItem, MediaAsset, PhotoEdit } from "@/lib/types";
import { MediaThumb } from "@/components/media/media-thumb";
import { MediaPicker } from "./media-picker";

export const LAYOUTS: { id: AlbumPage["layout"]; label: string; max: number }[] = [
  { id: "1", label: "1 foto", max: 1 },
  { id: "2", label: "2 fotos", max: 2 },
  { id: "3", label: "3 fotos (destaque)", max: 3 },
  { id: "4", label: "4 fotos (grade)", max: 4 },
  { id: "colagem", label: "Colagem (até 6)", max: 6 },
  { id: "texto", label: "Texto + 1 foto", max: 1 },
];

export function PageEditor({ page, media, edits, onClose }: { page: AlbumPage | null; media: MediaAsset[]; edits: PhotoEdit[]; onClose: () => void }) {
  const toast = useToast();
  const [p, setP] = useState<AlbumPage | null>(page);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setP(page), [page]);
  if (!p) return null;
  const max = LAYOUTS.find((l) => l.id === p.layout)?.max ?? 6;
  const byId = new Map(media.map((m) => [m.id, m]));
  const setItem = (i: number, patch: Partial<AlbumPageItem>) => setP({ ...p, items: p.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const move = (i: number, d: number) => {
    const items = [...p.items];
    const [x] = items.splice(i, 1);
    items.splice(Math.max(0, Math.min(items.length, i + d)), 0, x);
    setP({ ...p, items });
  };

  async function save() {
    setBusy(true);
    try {
      await getRepo().update("album_pages", p!.id, {
        layout: p!.layout,
        title: p!.title.slice(0, 160),
        text: p!.text.slice(0, 5000),
        date_label: p!.date_label.slice(0, 80),
        background: p!.background,
        frame: p!.frame,
        items: p!.items,
        included: p!.included,
      });
      toast("Página salva.");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao salvar", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!page} onOpenChange={(v) => !v && onClose()} size="xl" title="Editar página" description={p.items.length > max ? `Este layout mostra ${max} foto(s); as demais ficam guardadas, mas não aparecem no PDF.` : undefined}>
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <Field label="Layout">
            {(a) => (
              <Select {...a} value={p.layout} onChange={(e) => setP({ ...p, layout: e.target.value as AlbumPage["layout"] })}>
                {LAYOUTS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Título">{(a) => <Input {...a} value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} />}</Field>
          <Field label="Data ou subtítulo">{(a) => <Input {...a} value={p.date_label} onChange={(e) => setP({ ...p, date_label: e.target.value })} />}</Field>
          <Field label="Texto / história" hint="Aparece abaixo das fotos (ou em destaque no layout de texto).">
            {(a) => <Textarea {...a} rows={5} value={p.text} onChange={(e) => setP({ ...p, text: e.target.value })} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fundo da página">
              {(a) => (
                <div className="flex items-center gap-2">
                  <Input {...a} type="color" value={p.background || "#ffffff"} onChange={(e) => setP({ ...p, background: e.target.value })} />
                  {p.background && (
                    <button type="button" className="text-xs text-accent" onClick={() => setP({ ...p, background: "" })}>
                      padrão
                    </button>
                  )}
                </div>
              )}
            </Field>
            <Field label="Moldura das fotos">
              {(a) => (
                <Select {...a} value={p.frame} onChange={(e) => setP({ ...p, frame: e.target.value })}>
                  {FRAME_TEMPLATES.map((f) => (
                    <option key={f.template} value={f.template}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Checkbox label="Incluir esta página no PDF" checked={p.included} onChange={(e) => setP({ ...p, included: e.target.checked })} />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">
              Fotos ({p.items.length}/{max})
            </h3>
            <Button size="sm" variant="outline" onClick={() => setPicker(true)}>
              <ImagePlus className="h-4 w-4" /> Adicionar fotos
            </Button>
          </div>
          {!p.items.length && <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Nenhuma foto nesta página.</p>}
          <ul className="space-y-2">
            {p.items.map((it, i) => {
              const m = byId.get(it.media_id);
              const versions = edits.filter((e) => e.media_id === it.media_id);
              return (
                <li key={`${it.media_id}-${i}`} className={`grid grid-cols-[72px_1fr] gap-3 rounded-xl border p-2 ${i >= max ? "border-amber-300 opacity-60" : "border-line"}`}>
                  {m ? <MediaThumb asset={m} className="aspect-square w-[72px] rounded-lg" /> : <div className="aspect-square w-[72px] rounded-lg bg-surface-2" />}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input aria-label="Legenda da foto" placeholder="Legenda" value={it.caption} onChange={(e) => setItem(i, { caption: e.target.value })} className="sm:col-span-2" />
                    <Select aria-label="Encaixe" value={it.fit} onChange={(e) => setItem(i, { fit: e.target.value as AlbumPageItem["fit"] })}>
                      <option value="contain">Foto inteira (sem cortes)</option>
                      <option value="cover">Preencher (pode cortar bordas)</option>
                    </Select>
                    <Select aria-label="Versão" value={it.edit_id ?? ""} onChange={(e) => setItem(i, { edit_id: e.target.value || null })}>
                      <option value="">Original</option>
                      {versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </Select>
                    <Select aria-label="Moldura desta foto" value={it.frame} onChange={(e) => setItem(i, { frame: e.target.value })}>
                      <option value="">Moldura da página</option>
                      {FRAME_TEMPLATES.map((f) => (
                        <option key={f.template} value={f.template}>
                          {f.name}
                        </option>
                      ))}
                    </Select>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" aria-label="Mover para cima" onClick={() => move(i, -1)} disabled={i === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="Mover para baixo" onClick={() => move(i, 1)} disabled={i === p.items.length - 1}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="Remover foto da página" className="text-red-600" onClick={() => setP({ ...p, items: p.items.filter((_, j) => j !== i) })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={() => void save()} loading={busy}>
          Salvar página
        </Button>
      </div>
      <MediaPicker
        open={picker}
        onClose={() => setPicker(false)}
        media={media}
        onPick={(ids) => setP({ ...p, items: [...p.items, ...ids.map((id) => ({ media_id: id, edit_id: null, caption: byId.get(id)?.caption ?? "", frame: "", fit: "contain" as const }))] })}
      />
    </Modal>
  );
}
