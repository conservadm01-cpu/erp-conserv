"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";
import { useSubmit } from "../ui/useForm";

type Result = { ok: boolean; checked: number; brokenAtSeq?: string; reason?: string };

export function VerifyChainButton() {
  const [result, setResult] = useState<Result | null>(null);
  const { pending, error, run } = useSubmit();
  return (
    <div className="space-y-2">
      <Button variant="secondary" loading={pending} onClick={async () => { const r = await run(() => api<Result>("/api/audit/verify", { method: "POST" })); if (r) setResult(r); }}>
        Verificar integridade
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
      {result && (result.ok
        ? <Alert tone="success">Cadeia íntegra: {result.checked.toLocaleString("pt-BR")} registros verificados.</Alert>
        : <Alert tone="error" title="Inconsistência detectada">Registro nº {result.brokenAtSeq}: {result.reason}</Alert>)}
    </div>
  );
}
