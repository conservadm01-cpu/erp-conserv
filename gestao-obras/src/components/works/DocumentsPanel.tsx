"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, apiUpload, downloadVersion, ApiError } from "@/lib/api";
import { formatBytes, formatDateTime, formatDay } from "@/lib/format";
import { Button } from "../ui/Button";
import { SelectField, TextAreaField, TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { EmptyState } from "../ui/EmptyState";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useSubmit } from "../ui/useForm";
import { DocStatusBadge } from "./StatusBadges";

type Version = { id: string; versionNo: number; fileName: string; sizeBytes: number; sha256: string; uploadedAt: string; supersededAt: string | null; changeNote: string | null; uploadedById: string };
type Doc = {
  id: string; title: string; status: string; issuer: string | null; documentNumber: string | null; issueDate: string | null; expiryDate: string | null;
  reviewerNote: string | null; category: { code: string; name: string; requiresExpiry: boolean }; versions: Version[];
};
type Category = { code: string; name: string; requiresExpiry: boolean };

export function DocumentsPanel({ workId, uploadPath, documents, categories, canUpload, canReview, userId }: { workId?: string; uploadPath?: string; documents: Doc[]; categories: Category[]; canUpload: boolean; canReview: boolean; userId: string }) {
  const router = useRouter();
  const [showUpload, setShowUpload] = useState(false);
  const [versionFor, setVersionFor] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Doc | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [meta, setMeta] = useState({ categoryCode: "", title: "", issuer: "", documentNumber: "", issueDate: "", expiryDate: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const versionFileRef = useRef<HTMLInputElement>(null);
  const [changeNote, setChangeNote] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const upload = useSubmit();
  const newVersion = useSubmit();
  const category = categories.find((c) => c.code === meta.categoryCode);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData();
    Object.entries(meta).forEach(([k, v]) => form.append(k, v));
    const f = fileRef.current?.files?.[0];
    if (f) form.append("file", f);
    const res = await upload.run(() => apiUpload(uploadPath ?? `/api/works/${workId}/documents`, form));
    if (res) {
      setShowUpload(false);
      setMeta({ categoryCode: "", title: "", issuer: "", documentNumber: "", issueDate: "", expiryDate: "" });
      setNotice("Documento enviado. Ele aguarda análise.");
      router.refresh();
    }
  }

  async function onNewVersion(e: React.FormEvent, docId: string) {
    e.preventDefault();
    const form = new FormData();
    form.append("changeNote", changeNote);
    form.append("expiryDate", newExpiry);
    const f = versionFileRef.current?.files?.[0];
    if (f) form.append("file", f);
    const res = await newVersion.run(() => apiUpload(`/api/documents/${docId}/versions`, form));
    if (res) {
      setVersionFor(null);
      setChangeNote("");
      setNewExpiry("");
      setNotice("Nova versão enviada. O documento volta para análise.");
      router.refresh();
    }
  }

  async function act(fn: () => Promise<unknown>, ok: string) {
    setActionError(null);
    try {
      await fn();
      setNotice(ok);
      router.refresh();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Erro inesperado.");
    }
  }

  return (
    <div className="space-y-4">
      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}
      {canUpload && !showUpload && <Button onClick={() => setShowUpload(true)}>Enviar documento</Button>}
      {showUpload && (
        <form onSubmit={onUpload} className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-2" noValidate>
          {upload.error && <div className="sm:col-span-2"><Alert tone="error">{upload.error}</Alert></div>}
          <SelectField label="Categoria" required value={meta.categoryCode} onChange={(e) => setMeta({ ...meta, categoryCode: e.target.value })} error={upload.fieldErrors.categoryCode}>
            <option value="">Selecione…</option>
            {categories.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </SelectField>
          <TextField label="Título" required value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} error={upload.fieldErrors.title} maxLength={200} />
          <TextField label="Emissor" value={meta.issuer} onChange={(e) => setMeta({ ...meta, issuer: e.target.value })} maxLength={200} />
          <TextField label="Número" value={meta.documentNumber} onChange={(e) => setMeta({ ...meta, documentNumber: e.target.value })} maxLength={100} />
          <TextField label="Data de emissão" type="date" value={meta.issueDate} onChange={(e) => setMeta({ ...meta, issueDate: e.target.value })} />
          <TextField label="Validade" type="date" required={category?.requiresExpiry} value={meta.expiryDate} onChange={(e) => setMeta({ ...meta, expiryDate: e.target.value })} error={upload.fieldErrors.expiryDate} />
          <div className="sm:col-span-2">
            <label htmlFor="doc-file" className="label">Arquivo <span className="text-red-600" aria-hidden="true">*</span></label>
            <input id="doc-file" ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="block w-full text-sm" />
            <p className="mt-1 text-xs text-slate-500">PDF, PNG, JPEG ou WEBP. O arquivo fica em armazenamento privado e só é baixado por link temporário.</p>
            {upload.fieldErrors.file && <p className="mt-1 text-xs text-red-700">{upload.fieldErrors.file.join(" ")}</p>}
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" loading={upload.pending}>Enviar</Button>
            <Button variant="secondary" onClick={() => setShowUpload(false)} disabled={upload.pending}>Cancelar</Button>
          </div>
        </form>
      )}

      {documents.length === 0 ? (
        <EmptyState title="Nenhum documento enviado" />
      ) : (
        <ul className="space-y-3">
          {documents.map((d) => {
            const current = d.versions.find((v) => !v.supersededAt) ?? d.versions[0];
            const ownUpload = current?.uploadedById === userId;
            return (
              <li key={d.id} className="card p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{d.title} <DocStatusBadge status={d.status} /></p>
                    <p className="text-xs text-slate-500">
                      {d.category.name}{d.documentNumber ? ` · nº ${d.documentNumber}` : ""}{d.issuer ? ` · ${d.issuer}` : ""} · emissão {formatDay(d.issueDate)} · validade {formatDay(d.expiryDate)}
                    </p>
                    {d.reviewerNote && <p className="mt-1 text-sm text-slate-700">Parecer: {d.reviewerNote}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canReview && d.status === "ENVIADO" && !ownUpload && <Button variant="secondary" onClick={() => act(() => api(`/api/documents/${d.id}/review`, { body: { decision: "INICIAR" } }), "Análise iniciada.")}>Iniciar análise</Button>}
                    {canReview && ["ENVIADO", "EM_REVISAO"].includes(d.status) && !ownUpload && (
                      <>
                        <Button onClick={() => act(() => api(`/api/documents/${d.id}/review`, { body: { decision: "APROVAR" } }), "Documento aprovado.")}>Aprovar</Button>
                        <Button variant="danger" onClick={() => setRejecting(d)}>Rejeitar</Button>
                      </>
                    )}
                    {canUpload && versionFor !== d.id && <Button variant="secondary" onClick={() => setVersionFor(d.id)}>Nova versão</Button>}
                  </div>
                </div>
                {versionFor === d.id && (
                  <form onSubmit={(e) => onNewVersion(e, d.id)} className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2" noValidate>
                    {newVersion.error && <div className="sm:col-span-2"><Alert tone="error">{newVersion.error}</Alert></div>}
                    <TextAreaField className="sm:col-span-2" label="Motivo da substituição" required rows={2} value={changeNote} onChange={(e) => setChangeNote(e.target.value)} error={newVersion.fieldErrors.changeNote} maxLength={500} />
                    <TextField label="Nova validade (opcional)" type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} />
                    <div>
                      <label htmlFor={`v-${d.id}`} className="label">Arquivo</label>
                      <input id={`v-${d.id}`} ref={versionFileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="block w-full text-sm" />
                    </div>
                    <div className="flex gap-2 sm:col-span-2">
                      <Button type="submit" loading={newVersion.pending}>Enviar versão</Button>
                      <Button variant="secondary" onClick={() => setVersionFor(null)}>Cancelar</Button>
                    </div>
                  </form>
                )}
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-slate-600">Versões ({d.versions.length})</summary>
                  <ul className="mt-2 divide-y divide-slate-100">
                    {d.versions.map((v) => (
                      <li key={v.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p>v{v.versionNo} · {v.fileName} · {formatBytes(v.sizeBytes)} · {formatDateTime(v.uploadedAt)} {v.supersededAt && <span className="text-xs text-slate-500">(substituída)</span>}</p>
                          {v.changeNote && <p className="text-xs text-slate-500">Motivo: {v.changeNote}</p>}
                          <p className="break-all font-mono text-[11px] text-slate-500">SHA-256 {v.sha256}</p>
                        </div>
                        <Button variant="ghost" onClick={() => act(() => downloadVersion(d.id, v.id), "Download autorizado.")}>Baixar</Button>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(rejecting)}
        title="Rejeitar documento"
        description={`O documento "${rejecting?.title ?? ""}" será marcado como rejeitado. Quem enviou poderá enviar uma nova versão.`}
        confirmLabel="Rejeitar"
        reasonLabel="Motivo da rejeição"
        onClose={() => setRejecting(null)}
        onConfirm={async (note) => {
          if (!rejecting) return;
          await api(`/api/documents/${rejecting.id}/review`, { body: { decision: "REJEITAR", note } });
          setNotice("Documento rejeitado.");
          router.refresh();
        }}
      />
    </div>
  );
}
