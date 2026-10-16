"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";

/** Remove unidade sem histórico; com histórico o servidor recusa e orienta a inativar. */
export function OrgUnitRemoveButton({ unitId }: { unitId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>Remover unidade</Button>
      <ConfirmDialog
        open={open}
        title="Remover unidade"
        description="Só é possível remover unidades criadas por engano e nunca usadas (sem subordinadas, usuários, obras, pessoas, empresas, equipamentos ou agenda). Nos demais casos, use a inativação. A remoção fica registrada na auditoria."
        confirmLabel="Remover"
        tone="danger"
        reasonLabel="Justificativa"
        onClose={() => setOpen(false)}
        onConfirm={async (reason) => {
          const res = await api<{ parentId: string }>(`/api/org-units/${unitId}`, { method: "DELETE", body: { reason } });
          router.push(`/organizacao/${res.parentId}`);
        }}
      />
    </>
  );
}
