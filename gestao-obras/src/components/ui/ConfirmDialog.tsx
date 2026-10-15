"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { TextAreaField } from "./Field";
import { Alert } from "./Alert";

type Props = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  /** Quando definido, exige uma justificativa antes de confirmar. */
  reasonLabel?: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
};

/** Diálogo de confirmação para operações críticas. */
export function ConfirmDialog({ open, title, description, confirmLabel, tone = "danger", reasonLabel, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setReason("");
      setError(null);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  async function confirm() {
    if (reasonLabel && !reason.trim()) {
      setError("Informe a justificativa.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="confirm-title"
      className="w-full max-w-md rounded-lg p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      <div className="space-y-4 p-6">
        <h2 id="confirm-title" className="text-lg font-semibold">{title}</h2>
        <div className="text-sm text-slate-700">{description}</div>
        {reasonLabel && <TextAreaField label={reasonLabel} required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />}
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant={tone} onClick={confirm} loading={busy}>{confirmLabel}</Button>
        </div>
      </div>
    </dialog>
  );
}
