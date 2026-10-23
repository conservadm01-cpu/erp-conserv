"use client";
import { useEffect, useState } from "react";
import { Heart, Pencil, Sparkles, Trash2, Camera } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Button, LinkButton } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { getRepo } from "@/lib/data";
import { deleteMedia } from "@/lib/media/upload";
import { bytesLabel, fmtDateTime } from "@/lib/format";
import type { MediaAsset } from "@/lib/types";
import { MediaPreview } from "./media-thumb";

const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function MediaDetail({ asset, onClose, onAskStory }: { asset: MediaAsset | null; onClose: () => void; onAskStory: (a: MediaAsset) => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ caption: "", tags: "", people: "", album: "", favorite: false, instagrammable: false });
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (asset) {
      setForm({ caption: asset.caption, tags: asset.tags.join(", "), people: asset.people.join(", "), album: asset.album, favorite: asset.favorite, instagrammable: asset.instagrammable });
      setConfirm(false);
    }
  }, [asset]);

  if (!asset) return null;

  async function save() {
    setBusy(true);
    try {
      await getRepo().update("media_assets", asset!.id, {
        caption: form.caption.trim().slice(0, 500),
        tags: splitList(form.tags),
        people: splitList(form.people),
        album: form.album.trim().slice(0, 80),
        favorite: form.favorite,
        instagrammable: form.instagrammable,
      });
      toast("Informações salvas.");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao salvar", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteMedia(asset!);
      toast("Mídia excluída, com suas versões editadas.");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao excluir", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!asset} onOpenChange={(v) => !v && onClose()} size="xl" title={asset.caption || asset.original_name} description={`${fmtDateTime(asset.taken_at)} · ${bytesLabel(asset.size_bytes)}${asset.width ? ` · ${asset.width}×${asset.height}px` : ""}`}>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <MediaPreview asset={asset} />
          {asset.story_answers.length > 0 && (
            <div className="rounded-xl border border-line bg-surface-2 p-3 text-sm">
              <div className="mb-1 font-semibold">História do momento</div>
              <ul className="space-y-1.5">
                {asset.story_answers.map((s, i) => (
                  <li key={i}>
                    <span className="text-muted">{s.question}</span>
                    <br />
                    {s.answer}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label="Legenda">{(p) => <Textarea {...p} rows={2} className="min-h-0" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />}</Field>
          <Field label="Álbum ou evento" hint="Ex.: Glaciar, Jantar de aniversário">{(p) => <Input {...p} value={form.album} onChange={(e) => setForm({ ...form, album: e.target.value })} />}</Field>
          <Field label="Etiquetas" hint="Separadas por vírgula">{(p) => <Input {...p} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />}</Field>
          <Field label="Pessoas" hint="Separadas por vírgula">{(p) => <Input {...p} value={form.people} onChange={(e) => setForm({ ...form, people: e.target.value })} />}</Field>
          <div className="flex flex-wrap gap-4">
            <Checkbox label="Favorita" checked={form.favorite} onChange={(e) => setForm({ ...form, favorite: e.target.checked })} />
            <Checkbox label="Instagramável" checked={form.instagrammable} onChange={(e) => setForm({ ...form, instagrammable: e.target.checked })} />
          </div>
          {asset.lat != null && <Badge tone="blue">Localização GPS salva</Badge>}
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <Button type="submit" loading={busy}>
              Salvar
            </Button>
            {asset.kind === "image" && (
              <>
                <LinkButton variant="outline" href={`/midia/foto/${asset.id}`}>
                  <Pencil className="h-4 w-4" /> Editar foto
                </LinkButton>
                <Button variant="outline" onClick={() => onAskStory(asset)}>
                  <Sparkles className="h-4 w-4" /> Registrar momento
                </Button>
              </>
            )}
            {!confirm ? (
              <Button variant="ghost" className="text-red-600" onClick={() => setConfirm(true)}>
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-2 py-1 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
                Excluir o original e todas as versões?
                <Button size="sm" variant="danger" onClick={() => void remove()} loading={busy}>
                  Sim, excluir
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                  Cancelar
                </Button>
              </span>
            )}
          </div>
          <p className="flex items-center gap-1 text-xs text-muted">
            {asset.favorite ? <Heart className="h-3 w-3 fill-current" /> : <Camera className="h-3 w-3" />} Arquivo original preservado; edições são salvas como versões separadas.
          </p>
        </form>
      </div>
    </Modal>
  );
}
