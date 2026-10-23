import { openDB, type IDBPDatabase } from "idb";
import type { ID, NewRow, Row, TableName } from "@/lib/types";
import { matches, nowIso, stamp, type Bucket, type FileStore, type Repo, type Where } from "./repo";
import { notify } from "./events";

export const LOCAL_TABLES: TableName[] = [
  "profiles", "trips", "trip_members", "destinations", "travelers", "providers", "search_queries",
  "quotes", "activities", "itinerary_days", "itinerary_items", "budgets", "budget_categories",
  "expenses", "payments", "reservations", "documents", "diary_entries", "media_assets",
  "photo_edits", "albums", "album_pages", "video_projects", "notifications",
];

export const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001";
const DB_NAME = "viajar-plus";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function localDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const t of LOCAL_TABLES) {
          if (!db.objectStoreNames.contains(t)) {
            const store = db.createObjectStore(t, { keyPath: "id" });
            store.createIndex("trip_id", "trip_id");
          }
        }
        if (!db.objectStoreNames.contains("files")) db.createObjectStore("files");
      },
    });
  }
  return dbPromise;
}

/** Apenas para testes: fecha e descarta a conexão. */
export async function resetLocalDb(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

export class LocalRepo implements Repo {
  readonly mode = "local" as const;

  async list<T extends TableName>(table: T, where?: Where<T>): Promise<Row<T>[]> {
    const db = await localDb();
    const tripId = (where as { trip_id?: string } | undefined)?.trip_id;
    const rows: Row<T>[] = tripId
      ? await db.getAllFromIndex(table, "trip_id", tripId)
      : await db.getAll(table);
    return rows.filter((r) => matches(r, where)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async get<T extends TableName>(table: T, id: ID): Promise<Row<T> | null> {
    const db = await localDb();
    return ((await db.get(table, id)) as Row<T> | undefined) ?? null;
  }

  async insert<T extends TableName>(table: T, row: NewRow<T>): Promise<Row<T>> {
    const db = await localDb();
    const full = stamp(row);
    await db.add(table, full);
    notify(table);
    return full;
  }

  async insertMany<T extends TableName>(table: T, rows: NewRow<T>[]): Promise<Row<T>[]> {
    const db = await localDb();
    const tx = db.transaction(table, "readwrite");
    const full = rows.map((r) => stamp(r));
    await Promise.all([...full.map((r) => tx.store.add(r)), tx.done]);
    notify(table);
    return full;
  }

  async update<T extends TableName>(table: T, id: ID, patch: Partial<Row<T>>): Promise<Row<T>> {
    const db = await localDb();
    const tx = db.transaction(table, "readwrite");
    const current = (await tx.store.get(id)) as Row<T> | undefined;
    if (!current) throw new Error(`Registro não encontrado em ${table}`);
    const next = { ...current, ...patch, id, updated_at: nowIso() } as Row<T>;
    await tx.store.put(next);
    await tx.done;
    notify(table);
    return next;
  }

  async remove<T extends TableName>(table: T, id: ID): Promise<void> {
    const db = await localDb();
    await db.delete(table, id);
    notify(table);
  }

  async currentUserId(): Promise<ID | null> {
    return LOCAL_USER_ID;
  }
}

const objectUrls = new Map<string, string>();

export class LocalFileStore implements FileStore {
  async put(bucket: Bucket, path: string, file: Blob): Promise<string> {
    const db = await localDb();
    await db.put("files", file, `${bucket}/${path}`);
    return path;
  }

  async get(bucket: Bucket, path: string): Promise<Blob | null> {
    const db = await localDb();
    return ((await db.get("files", `${bucket}/${path}`)) as Blob | undefined) ?? null;
  }

  async url(bucket: Bucket, path: string): Promise<string | null> {
    const key = `${bucket}/${path}`;
    const cached = objectUrls.get(key);
    if (cached) return cached;
    const blob = await this.get(bucket, path);
    if (!blob || typeof URL.createObjectURL !== "function") return null;
    const u = URL.createObjectURL(blob);
    objectUrls.set(key, u);
    return u;
  }

  async remove(bucket: Bucket, paths: string[]): Promise<void> {
    const db = await localDb();
    for (const p of paths) {
      const key = `${bucket}/${p}`;
      await db.delete("files", key);
      const u = objectUrls.get(key);
      if (u) {
        URL.revokeObjectURL?.(u);
        objectUrls.delete(key);
      }
    }
  }
}
