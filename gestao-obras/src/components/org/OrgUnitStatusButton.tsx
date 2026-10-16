"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";

export function OrgUnitStatusButton({ unitId, status }: { unitId: string; status: "ATIVA" | "INATIVA" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const target = status === "ATIVA" ? "INATIVA" : "ATIVA";
  return (
    <>
      <Button variant={target === "INATIVA" ? "danger" : "secondary"} onClick={() => setOpen(true)}>
        {target === "INATIVA" ? "Inativar unidade" : "Reativar unidade"}
      </Button>
      <ConfirmDialog
        open={open}
        title={target === "INATIVA" ? "Inativar unidade" : "Reativar unidade"}
        description={target === "INATIVA" ? "A unidade deixará de aceitar novos vínculos. Os acessos atribuídos nela ficam suspensos. O histórico é preservado." : "A unidade voltará a aceitar vínculos e acessos."}
        confirmLabel={target === "INATIVA" ? "Inativar" : "Reativar"}
        tone={target === "INATIVA" ? "danger" : "primary"}
        reasonLabel="Justificativa"
        onClose={() => setOpen(false)}
        onConfirm={async (reason) => {
          await api(`/api/org-units/${unitId}/status`, { body: { status: target, reason } });
          router.refresh();
        }}
      />
    </>
  );
}
