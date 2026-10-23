"use client";
import { localDb, LOCAL_TABLES, resetLocalDb } from "@/lib/data/local";

/** LGPD no modo local: exporta tudo que está no IndexedDB deste navegador (arquivos listados com tamanho e tipo). */
export async function exportLocalData(): Promise<Blob> {
  const db = await localDb();
  const tables: Record<string, unknown[]> = {};
  for (const t of LOCAL_TABLES) tables[t] = await db.getAll(t);
  const keys = (await db.getAllKeys("files")) as string[];
  const files: { key: string; size: number; type: string }[] = [];
  for (const k of keys) {
    const b = (await db.get("files", k)) as Blob | undefined;
    if (b) files.push({ key: k, size: b.size, type: b.type });
  }
  const payload = {
    exported_at: new Date().toISOString(),
    mode: "local",
    note: "Exportação dos dados guardados apenas neste navegador. Os arquivos de mídia são listados; baixe-os pela galeria se precisar das cópias.",
    tables,
    files,
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

/** Apaga todos os dados locais (tabelas, arquivos e preferências do VIAJAR+). */
export async function deleteLocalData(): Promise<void> {
  await resetLocalDb();
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("viajar:"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
