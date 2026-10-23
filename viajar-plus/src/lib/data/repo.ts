import type { ID, NewRow, Row, TableName } from "@/lib/types";

export type Where<T extends TableName> = Partial<Pick<Row<T>, Extract<keyof Row<T>, string>>>;

/** Acesso a dados independente do backend (Supabase com RLS ou IndexedDB local). */
export interface Repo {
  readonly mode: "supabase" | "local";
  list<T extends TableName>(table: T, where?: Where<T>): Promise<Row<T>[]>;
  get<T extends TableName>(table: T, id: ID): Promise<Row<T> | null>;
  insert<T extends TableName>(table: T, row: NewRow<T>): Promise<Row<T>>;
  insertMany<T extends TableName>(table: T, rows: NewRow<T>[]): Promise<Row<T>[]>;
  update<T extends TableName>(table: T, id: ID, patch: Partial<Row<T>>): Promise<Row<T>>;
  remove<T extends TableName>(table: T, id: ID): Promise<void>;
  currentUserId(): Promise<ID | null>;
}

export type Bucket = "media" | "documents";

/** Armazenamento de arquivos privados (fotos, vídeos, comprovantes). */
export interface FileStore {
  put(bucket: Bucket, path: string, file: Blob, tripId: ID): Promise<string>;
  get(bucket: Bucket, path: string): Promise<Blob | null>;
  /** URL temporária para exibição (signed URL no Supabase, object URL local). */
  url(bucket: Bucket, path: string): Promise<string | null>;
  remove(bucket: Bucket, paths: string[]): Promise<void>;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): ID {
  return crypto.randomUUID();
}

export function stamp<T extends TableName>(row: NewRow<T>): Row<T> {
  const now = nowIso();
  return { ...(row as object), id: row.id ?? newId(), created_at: now, updated_at: now } as Row<T>;
}

export function matches(row: object, where?: object): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v);
}
