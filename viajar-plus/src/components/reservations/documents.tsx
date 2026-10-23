"use client";
import { useRef, useState } from "react";
import { FileText, Paperclip, Trash2, ExternalLink as ExtIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { getFiles } from "@/lib/data";
import { deleteDocument, uploadDocument } from "@/lib/media/upload";
import { bytesLabel, fmtDate } from "@/lib/format";
import type { DocumentKind, ID, TripDocument } from "@/lib/types";

export const DOC_KIND_LABEL: Record<DocumentKind, string> = {
  voucher: "Voucher",
  comprovante: "Comprovante",
  bilhete: "Bilhete/cartão de embarque",
  seguro: "Apólice de seguro",
  documento: "Documento",
  outro: "Outro",
};

/** Abre o documento por URL temporária (assinada no Supabase). */
async function openDoc(doc: TripDocument) {
  const url = await getFiles().url("documents", doc.storage_path);
  if (!url) {
    alert("Não foi possível abrir o documento.");
    return;
  }
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.click();
}

export function DocumentList({ docs, onDeleted }: { docs: TripDocument[]; onDeleted?: () => void }) {
  const toast = useToast();
  if (!docs.length) return <p className="text-xs text-muted">Nenhum documento anexado.</p>;
  return (
    <ul className="space-y-1.5">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <button className="min-w-0 flex-1 truncate text-left text-accent hover:underline" onClick={() => void openDoc(d)}>
            {d.title}
            <ExtIcon className="ml-1 inline h-3 w-3" aria-hidden />
            <span className="sr-only"> (abre em nova aba)</span>
          </button>
          <span className="hidden text-xs text-muted sm:inline">
            {DOC_KIND_LABEL[d.kind]} · {bytesLabel(d.size_bytes)} · {fmtDate(d.created_at)}
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Excluir ${d.title}`}
            onClick={async () => {
              if (!confirm(`Excluir o documento "${d.title}"?`)) return;
              try {
                await deleteDocument(d);
                toast("Documento excluído");
                onDeleted?.();
              } catch (e) {
                toast(e instanceof Error ? e.message : "Falha ao excluir", "error");
              }
            }}
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function DocumentUploader({ tripId, reservationId, defaultKind = "voucher" }: { tripId: ID; reservationId?: ID | null; defaultKind?: DocumentKind }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<DocumentKind>(defaultKind);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    let ok = 0;
    for (const f of Array.from(files)) {
      try {
        await uploadDocument(tripId, f, { kind, title: f.name, reservation_id: reservationId ?? null });
        ok++;
      } catch (e) {
        toast(`${f.name}: ${e instanceof Error ? e.message : "falha no envio"}`, "error");
      }
    }
    if (ok) toast(`${ok} documento(s) anexado(s)`);
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`kind-${reservationId ?? "trip"}`}>Tipo de documento</label>
      <Select id={`kind-${reservationId ?? "trip"}`} className="h-8 w-auto text-xs" value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)}>
        {Object.entries(DOC_KIND_LABEL).map(([k, l]) => (
          <option key={k} value={k}>{l}</option>
        ))}
      </Select>
      <input ref={input} type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic" multiple onChange={(e) => void onFiles(e.target.files)} id={`up-${reservationId ?? "trip"}`} />
      <Button size="sm" variant="outline" loading={busy} onClick={() => input.current?.click()}>
        <Paperclip className="h-4 w-4" aria-hidden /> Anexar PDF ou imagem
      </Button>
    </div>
  );
}
