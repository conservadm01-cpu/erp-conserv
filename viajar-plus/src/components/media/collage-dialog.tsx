"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { createCollage } from "@/lib/photo/save";
import type { MediaAsset } from "@/lib/types";
import { MediaThumb } from "./media-thumb";

export function CollageDialog({ open, onClose, assets, tripId }: { open: boolean; onClose: () => void; assets: MediaAsset[]; tripId: string }) {
  const toast = useToast();
  const [ratio, setRatio] = useState("1");
  const [bg, setBg] = useState("#ffffff");
  const [caption, setCaption] = useState("Colagem");
  const [busy, setBusy] = useState(false);
  const photos = assets.filter((a) => a.kind === "image").slice(0, 6);

  async function make() {
    setBusy(true);
    try {
      await createCollage(tripId, photos, { ratio: Number(ratio), background: bg, caption });
      toast("Colagem salva na galeria.");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao criar colagem", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()} title="Criar colagem" description="Use de 2 a 6 fotos selecionadas. A colagem é salva como uma nova foto.">
      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {photos.map((p) => (
          <MediaThumb key={p.id} asset={p} className="aspect-square w-full rounded-lg" />
        ))}
      </div>
      {photos.length < 2 && <p className="mb-3 text-sm text-red-600">Selecione pelo menos 2 fotos.</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Formato">
          {(p) => (
            <Select {...p} value={ratio} onChange={(e) => setRatio(e.target.value)}>
              <option value="1">Quadrado</option>
              <option value="0.8">Vertical 4:5</option>
              <option value="0.5625">Story 9:16</option>
              <option value="1.5">Horizontal 3:2</option>
            </Select>
          )}
        </Field>
        <Field label="Fundo">{(p) => <Input {...p} type="color" value={bg} onChange={(e) => setBg(e.target.value)} />}</Field>
        <Field label="Legenda">{(p) => <Input {...p} value={caption} onChange={(e) => setCaption(e.target.value)} />}</Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={() => void make()} loading={busy} disabled={photos.length < 2}>
          Gerar colagem
        </Button>
      </div>
    </Modal>
  );
}
