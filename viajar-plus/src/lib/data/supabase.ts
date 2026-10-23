"use client";
import type { ID, NewRow, Row, TableName } from "@/lib/types";
import { supabaseBrowser } from "@/lib/supabase/client";
import { notify } from "./events";
import type { Bucket, FileStore, Repo, Where } from "./repo";

function fail(op: string, table: string, error: { message: string } | null): never {
  throw new Error(`Falha ao ${op} em ${table}: ${error?.message ?? "erro desconhecido"}`);
}

/** Implementação Supabase: toda leitura/escrita passa pelas políticas RLS do banco. */
export class SupabaseRepo implements Repo {
  readonly mode = "supabase" as const;
  private get sb() {
    return supabaseBrowser();
  }

  async list<T extends TableName>(table: T, where?: Where<T>): Promise<Row<T>[]> {
    let q = this.sb.from(table).select("*");
    if (where && Object.keys(where).length) q = q.match(where as Record<string, unknown>);
    const { data, error } = await q.order("created_at", { ascending: true });
    if (error) fail("listar", table, error);
    return (data ?? []) as Row<T>[];
  }

  async get<T extends TableName>(table: T, id: ID): Promise<Row<T> | null> {
    const { data, error } = await this.sb.from(table).select("*").eq("id", id).maybeSingle();
    if (error) fail("ler", table, error);
    return (data as Row<T>) ?? null;
  }

  async insert<T extends TableName>(table: T, row: NewRow<T>): Promise<Row<T>> {
    const { data, error } = await this.sb.from(table).insert(row as object).select("*").single();
    if (error) fail("inserir", table, error);
    notify(table);
    return data as Row<T>;
  }

  async insertMany<T extends TableName>(table: T, rows: NewRow<T>[]): Promise<Row<T>[]> {
    if (!rows.length) return [];
    const { data, error } = await this.sb.from(table).insert(rows as object[]).select("*");
    if (error) fail("inserir", table, error);
    notify(table);
    return data as Row<T>[];
  }

  async update<T extends TableName>(table: T, id: ID, patch: Partial<Row<T>>): Promise<Row<T>> {
    const clean = { ...(patch as Record<string, unknown>) };
    delete clean.id;
    delete clean.created_at;
    delete clean.updated_at;
    const { data, error } = await this.sb.from(table).update(clean).eq("id", id).select("*").single();
    if (error) fail("atualizar", table, error);
    notify(table);
    return data as Row<T>;
  }

  async remove<T extends TableName>(table: T, id: ID): Promise<void> {
    const { error } = await this.sb.from(table).delete().eq("id", id);
    if (error) fail("excluir", table, error);
    notify(table);
  }

  async currentUserId(): Promise<ID | null> {
    const { data } = await this.sb.auth.getUser();
    return data.user?.id ?? null;
  }
}

/** Arquivos em buckets privados. O upload passa pela API (validação no servidor). */
export class SupabaseFileStore implements FileStore {
  private get sb() {
    return supabaseBrowser();
  }

  async put(bucket: Bucket, path: string, file: Blob, tripId: ID): Promise<string> {
    const form = new FormData();
    form.set("bucket", bucket);
    form.set("path", path);
    form.set("trip_id", tripId);
    form.set("file", file);
    const res = await fetch("/api/media/upload", { method: "POST", body: form });
    const json = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
    if (!res.ok || !json.path) throw new Error(json.error ?? "Falha no upload");
    return json.path;
  }

  async get(bucket: Bucket, path: string): Promise<Blob | null> {
    const { data, error } = await this.sb.storage.from(bucket).download(path);
    if (error) return null;
    return data;
  }

  async url(bucket: Bucket, path: string): Promise<string | null> {
    // URL assinada com expiração de 1 hora
    const { data, error } = await this.sb.storage.from(bucket).createSignedUrl(path, 3600);
    if (error) return null;
    return data.signedUrl;
  }

  async remove(bucket: Bucket, paths: string[]): Promise<void> {
    if (!paths.length) return;
    const { error } = await this.sb.storage.from(bucket).remove(paths);
    if (error) throw new Error(`Falha ao excluir arquivos: ${error.message}`);
  }
}
