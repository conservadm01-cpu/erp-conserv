"use client";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-4">
      <Alert tone="error" title="Não foi possível carregar esta página">
        Tente novamente. Se o problema persistir, informe ao suporte o código {error.digest ?? "indisponível"}.
      </Alert>
      <Button variant="secondary" onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
