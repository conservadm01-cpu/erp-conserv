"use client";

import { downloadVersion } from "@/lib/api";
import { Button } from "../ui/Button";
import { useSubmit } from "../ui/useForm";

/** Baixa a versão vigente de um documento por link temporário (o acesso é auditado). */
export function DownloadButton({ documentId, versionId, label = "Baixar arquivo" }: { documentId: string; versionId: string; label?: string }) {
  const { pending, error, run } = useSubmit();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button variant="ghost" loading={pending} onClick={() => run(() => downloadVersion(documentId, versionId))}>{label}</Button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
