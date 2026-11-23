"use client";

// Fila de envio persistente (IndexedDB).
// Tudo o que precisa chegar ao Supabase — criação da sessão, cada segmento de
// vídeo e o encerramento — vira um item da fila ANTES de qualquer tentativa de
// rede. Assim, se a conexão cair ou o navegador for fechado, os itens continuam
// gravados no aparelho e são enviados na próxima oportunidade, na ordem certa.

import { supabase } from "@/lib/supabase";

export type QueueJob =
  | { kind: "session"; userId: string; gravacaoId: string; obraId: string | null; inicio: string; metadata: Record<string, string> }
  | { kind: "segment"; userId: string; gravacaoId: string; part: number; blob: Blob; inicio: string; duracaoMs: number }
  | { kind: "finalize"; userId: string; gravacaoId: string; fim: string };

type StoredJob = QueueJob & { seq?: number; attempts: number; lastError?: string };

export type QueueSnapshot = { pending: number; pendingBytes: number; processing: boolean; lastError: string | null; online: boolean };

const DB_NAME = "construcam-fila";
const STORE = "jobs";
const BUCKET = "obras-videos";

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "seq", autoIncrement: true });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error("Transação IndexedDB abortada"));
  }));
}

const allJobs = () => tx<StoredJob[]>("readonly", s => s.getAll() as IDBRequest<StoredJob[]>);
const putJob = (job: StoredJob) => tx("readwrite", s => s.put(job));
const deleteJob = (seq: number) => tx("readwrite", s => s.delete(seq));

// ---------- estado observável ----------
let snapshot: QueueSnapshot = { pending: 0, pendingBytes: 0, processing: false, lastError: null, online: true };
const listeners = new Set<(s: QueueSnapshot) => void>();
function emit(patch: Partial<QueueSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach(l => l(snapshot));
}
export function subscribeQueue(listener: (s: QueueSnapshot) => void) {
  listeners.add(listener);
  listener(snapshot);
  return () => { listeners.delete(listener); };
}

async function refreshCounts() {
  const jobs = await allJobs();
  emit({
    pending: jobs.length,
    pendingBytes: jobs.reduce((n, j) => n + (j.kind === "segment" ? j.blob.size : 0), 0)
  });
}

export async function enqueue(job: QueueJob) {
  await putJob({ ...job, attempts: 0 });
  await refreshCounts();
  void processQueue();
}

// Considera sucesso quando o item já existe no servidor (retentativa de algo
// que chegou, mas cuja resposta se perdeu).
function isDuplicate(err: unknown) {
  const e = err as { code?: string; statusCode?: string | number; message?: string } | null;
  if (!e) return false;
  return e.code === "23505" || String(e.statusCode) === "409" || /already exists|duplicate/i.test(e.message ?? "");
}

async function runJob(job: StoredJob) {
  if (!supabase) throw new Error("Supabase não configurado.");
  if (job.kind === "session") {
    const { error } = await supabase.from("gravacoes").insert({
      id: job.gravacaoId, obra_id: job.obraId ?? null, profissional_id: job.userId,
      status: "iniciada", inicio: job.inicio, metadata: job.metadata
    });
    if (error && !isDuplicate(error)) throw error;
  } else if (job.kind === "segment") {
    const ext = job.blob.type.includes("mp4") ? "mp4" : "webm";
    const path = `${job.gravacaoId}/${String(job.part).padStart(6, "0")}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, job.blob, {
      contentType: job.blob.type || "application/octet-stream", upsert: false
    });
    if (upErr && !isDuplicate(upErr)) throw upErr;
    const { error: rowErr } = await supabase.from("arquivos_video").insert({
      gravacao_id: job.gravacaoId, caminho_storage: path, numero_segmento: job.part,
      tamanho_bytes: job.blob.size, inicio_segmento: job.inicio, duracao_ms: job.duracaoMs
    });
    if (rowErr && !isDuplicate(rowErr)) throw rowErr;
  } else {
    const { error } = await supabase.from("gravacoes")
      .update({ status: "finalizada", fim: job.fim })
      .eq("id", job.gravacaoId);
    if (error) throw error;
  }
}

let running: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

export function processQueue(): Promise<void> {
  if (running) return running;
  running = (async () => {
    emit({ processing: true });
    try {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return;
      let failures = 0;
      // Processa em ordem de criação. Itens de outro usuário (aparelho
      // compartilhado) ficam aguardando o login desse usuário.
      const jobs = (await allJobs()).filter(j => j.userId === userId).sort((a, b) => a.seq! - b.seq!);
      const blocked = new Set<string>();
      for (const job of jobs) {
        if (typeof navigator !== "undefined" && !navigator.onLine) { failures++; break; }
        // Se um item de uma gravação falhou, os seguintes dela esperam (a sessão
        // precisa existir antes dos segmentos, e o encerramento vem por último).
        if (blocked.has(job.gravacaoId)) continue;
        try {
          await runJob(job);
          await deleteJob(job.seq!);
          emit({ lastError: null });
        } catch (err) {
          failures++;
          blocked.add(job.gravacaoId);
          const message = err instanceof Error ? err.message : (err as { message?: string })?.message ?? "Falha no envio";
          await putJob({ ...job, attempts: job.attempts + 1, lastError: message });
          emit({ lastError: message });
        }
        await refreshCounts();
      }
      if (failures > 0) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => void processQueue(), 15000);
      }
    } finally {
      await refreshCounts().catch(() => undefined);
      emit({ processing: false });
      running = null;
    }
  })();
  return running;
}

let started = false;
export function startQueueWorker() {
  if (started || typeof window === "undefined") return;
  started = true;
  emit({ online: navigator.onLine });
  window.addEventListener("online", () => { emit({ online: true }); void processQueue(); });
  window.addEventListener("offline", () => emit({ online: false }));
  setInterval(() => void processQueue(), 60000);
  supabase?.auth.onAuthStateChange(event => { if (event === "SIGNED_IN") void processQueue(); });
  // Pede ao navegador para não apagar a fila quando faltar espaço.
  void navigator.storage?.persist?.().catch(() => undefined);
  void refreshCounts().then(() => processQueue()).catch(() => undefined);
}
