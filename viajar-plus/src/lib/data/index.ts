import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LocalFileStore, LocalRepo } from "./local";
import { SupabaseFileStore, SupabaseRepo } from "./supabase";
import type { FileStore, Repo } from "./repo";

let repo: Repo | null = null;
let files: FileStore | null = null;

/** Modo de dados ativo: Supabase quando configurado; caso contrário, demonstração local. */
export function dataMode(): "supabase" | "local" {
  return isSupabaseConfigured() ? "supabase" : "local";
}

export function getRepo(): Repo {
  if (!repo) repo = dataMode() === "supabase" ? new SupabaseRepo() : new LocalRepo();
  return repo;
}

export function getFiles(): FileStore {
  if (!files) files = dataMode() === "supabase" ? new SupabaseFileStore() : new LocalFileStore();
  return files;
}

/** Apenas para testes. */
export function __setDataBackends(r: Repo | null, f: FileStore | null): void {
  repo = r;
  files = f;
}

export * from "./repo";
