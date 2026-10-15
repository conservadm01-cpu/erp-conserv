"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { WORK_STATUS } from "./labels";

type T = { action: string; label: string; requiresReason: boolean; to: string };

const DANGER = new Set(["cancelar", "rejeitar", "suspender", "devolver"]);

export function WorkActions({ workId, version, transitions }: { workId: string; version: number; transitions: T[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<T | null>(null);
  if (!transitions.length) return null;
  return (
    <>
      {transitions.map((t) => (
        <Button key={t.action} variant={DANGER.has(t.action) ? "secondary" : "primary"} onClick={() => setSelected(t)}>
          {t.label}
        </Button>
      ))}
      <ConfirmDialog
        open={Boolean(selected)}
        title={selected?.label ?? ""}
        description={selected ? <>A obra passará para a situação <strong>{WORK_STATUS[selected.to]?.label ?? selected.to}</strong>. A mudança fica registrada no histórico e na auditoria.</> : ""}
        confirmLabel="Confirmar"
        tone={selected && DANGER.has(selected.action) ? "danger" : "primary"}
        reasonLabel={selected?.requiresReason ? "Justificativa (mínimo de 10 caracteres)" : undefined}
        onClose={() => setSelected(null)}
        onConfirm={async (reason) => {
          if (!selected) return;
          await api(`/api/works/${workId}/transitions`, { body: { action: selected.action, reason: reason || null, version } });
          router.refresh();
        }}
      />
    </>
  );
}
