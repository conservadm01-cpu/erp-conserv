"use client";
import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { uploadMediaFiles } from "@/lib/media/upload";
import { UPLOAD_LIMITS } from "@/lib/media/validate";
import { Checkbox } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import type { ID, MediaAsset } from "@/lib/types";
import { cn } from "@/lib/cn";

const KEEP_KEY = "viajar:keep-location";

function readKeep(): boolean {
  try {
    return localStorage.getItem(KEEP_KEY) === "1";
  } catch {
    return false;
  }
}

/** Área de envio múltiplo (botão ou arrastar e soltar). Sem limite de quantidade — apenas o tamanho por arquivo e a cota do armazenamento. */
export function UploadZone({ tripId, onUploaded }: { tripId: ID; onUploaded: (assets: MediaAsset[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<{ name: string; error: string }[]>([]);
  const [keepLocation, setKeep] = useState<boolean>(() => (typeof window === "undefined" ? false : readKeep()));

  async function handle(files: FileList | File[] | null) {
    const list = files ? Array.from(files) : [];
    if (!list.length) return;
    setErrors([]);
    setProgress({ done: 0, total: list.length });
    const res = await uploadMediaFiles(tripId, list, { keepLocation, onProgress: (done, total) => setProgress({ done, total }) });
    setProgress(null);
    setErrors(res.errors);
    if (res.ok.length) onUploaded(res.ok);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handle(e.dataTransfer.files);
        }}
        className={cn("flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition", drag ? "border-accent bg-accent/10" : "border-line bg-surface")}
      >
        <UploadCloud className="h-9 w-9 text-accent" aria-hidden />
        <p className="font-medium">Arraste fotos, vídeos ou áudios para cá</p>
        <p className="text-xs text-muted">
          Quantas quiser. Até {Math.round(UPLOAD_LIMITS.image / 1048576)} MB por foto e {Math.round(UPLOAD_LIMITS.video / 1048576)} MB por vídeo. Formatos verificados pelo conteúdo do arquivo.
        </p>
        <button type="button" className="mt-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg" onClick={() => input.current?.click()} disabled={!!progress}>
          Escolher arquivos
        </button>
        <input ref={input} type="file" multiple accept="image/*,video/*,audio/*" className="sr-only" aria-label="Escolher arquivos de mídia" onChange={(e) => void handle(e.target.files)} />
        {progress && (
          <div className="w-full max-w-sm" role="status" aria-live="polite">
            <div className="mb-1 text-xs text-muted">
              Enviando {progress.done} de {progress.total}…
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-accent transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
      <Checkbox
        checked={keepLocation}
        onChange={(e) => {
          setKeep(e.target.checked);
          try {
            localStorage.setItem(KEEP_KEY, e.target.checked ? "1" : "0");
          } catch {
            /* ignore */
          }
        }}
        label="Manter a localização GPS das fotos (útil para o mapa de memórias; desligado por padrão para proteger sua privacidade)"
      />
      {errors.length > 0 && (
        <Notice tone="error" title={`${errors.length} arquivo(s) não enviado(s)`}>
          <ul className="list-disc pl-4">
            {errors.map((e, i) => (
              <li key={i}>
                <strong>{e.name}</strong>: {e.error}
              </li>
            ))}
          </ul>
        </Notice>
      )}
    </div>
  );
}
