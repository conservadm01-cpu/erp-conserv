// =====================================================================
// DATABASE — banco reativo da Academia ConServ
// ---------------------------------------------------------------------
// Carrega tudo em memória na abertura (1 requisição em lote), serve a UI
// de forma sincrona e grava cada alteração no adaptador. A UI nunca
// conhece o adaptador: ela usa os repositórios (data/repositories) e os
// hooks (state/useCollection).
// =====================================================================

import { resolveAdapter, type KeyValueAdapter, type KeyValueEntry } from "./adapters";
import { COLLECTIONS, type CollectionName, type Schema } from "./schema";
import { primeFromIds } from "../core/ids";

export const DB_PREFIX = "academia:v1:";
const ID_PREFIXES = ["CNT", "CRS", "MOD", "LES", "QST", "QIZ", "GAM", "CHL", "CUR", "CMP", "PTH", "HBK", "BDG", "SRC"];

type Row = { id: string } & Record<string, unknown>;
type Listener = () => void;

function keyFor(collection: CollectionName, id: string): string {
  return `${DB_PREFIX}${collection}:${id}`;
}

export interface DbStatus {
  adapter: string;
  shared: boolean;
  loaded: boolean;
  pendingWrites: number;
  lastError: string | null;
  records: number;
}

class Database {
  private adapter: KeyValueAdapter = resolveAdapter();
  private cache = new Map<CollectionName, Map<string, Row>>();
  private snapshots = new Map<CollectionName, readonly unknown[]>();
  private listeners = new Set<Listener>();
  private pending = 0;
  private loaded = false;
  private lastError: string | null = null;
  private version = 0;

  constructor() {
    for (const name of COLLECTIONS) this.cache.set(name, new Map());
  }

  // ---------------- ciclo de vida ----------------

  get adapterName(): string {
    return this.adapter.name;
  }

  /** Permite injetar outro adaptador (testes, modo demonstração). */
  useAdapter(adapter: KeyValueAdapter): void {
    this.adapter = adapter;
    this.loaded = false;
    for (const name of COLLECTIONS) this.cache.get(name)?.clear();
    this.bump();
  }

  async load(): Promise<void> {
    const entries = await this.adapter.entries(DB_PREFIX);
    for (const name of COLLECTIONS) this.cache.get(name)?.clear();
    for (const entry of entries) {
      const rest = entry.key.slice(DB_PREFIX.length);
      const sep = rest.indexOf(":");
      if (sep < 0) continue;
      const collection = rest.slice(0, sep) as CollectionName;
      const bucket = this.cache.get(collection);
      if (!bucket) continue;
      try {
        const row = JSON.parse(entry.value) as Row;
        if (row && typeof row.id === "string") bucket.set(row.id, row);
      } catch {
        this.lastError = `Registro ilegível em ${entry.key}`;
      }
    }
    this.primeIdCounters();
    this.loaded = true;
    this.bump();
  }

  /** Garante que novos IDs sequenciais não colidam com os já gravados. */
  private primeIdCounters(): void {
    const allIds: string[] = [];
    for (const bucket of this.cache.values()) allIds.push(...bucket.keys());
    for (const prefix of ID_PREFIXES) primeFromIds(prefix, allIds);
  }

  status(): DbStatus {
    let records = 0;
    for (const bucket of this.cache.values()) records += bucket.size;
    return {
      adapter: this.adapter.name,
      shared: this.adapter.shared,
      loaded: this.loaded,
      pendingWrites: this.pending,
      lastError: this.lastError,
      records,
    };
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  // ---------------- reatividade ----------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getVersion(): number {
    return this.version;
  }

  private bump(collection?: CollectionName): void {
    this.version += 1;
    if (collection) this.snapshots.delete(collection);
    else this.snapshots.clear();
    for (const l of [...this.listeners]) l();
  }

  // ---------------- leitura ----------------

  list<K extends CollectionName>(collection: K): readonly Schema[K][] {
    const cached = this.snapshots.get(collection);
    if (cached) return cached as readonly Schema[K][];
    const rows = [...(this.cache.get(collection)?.values() ?? [])] as unknown as Schema[K][];
    this.snapshots.set(collection, rows);
    return rows;
  }

  byId<K extends CollectionName>(collection: K, id: string | undefined | null): Schema[K] | undefined {
    if (!id) return undefined;
    return this.cache.get(collection)?.get(id) as unknown as Schema[K] | undefined;
  }

  find<K extends CollectionName>(collection: K, predicate: (row: Schema[K]) => boolean): Schema[K] | undefined {
    for (const row of this.cache.get(collection)?.values() ?? []) {
      if (predicate(row as unknown as Schema[K])) return row as unknown as Schema[K];
    }
    return undefined;
  }

  filter<K extends CollectionName>(collection: K, predicate: (row: Schema[K]) => boolean): Schema[K][] {
    const out: Schema[K][] = [];
    for (const row of this.cache.get(collection)?.values() ?? []) {
      if (predicate(row as unknown as Schema[K])) out.push(row as unknown as Schema[K]);
    }
    return out;
  }

  count<K extends CollectionName>(collection: K): number {
    return this.cache.get(collection)?.size ?? 0;
  }

  // ---------------- escrita ----------------

  /** Grava (insere ou substitui) e devolve o registro salvo. */
  put<K extends CollectionName>(collection: K, record: Schema[K]): Schema[K] {
    const row = record as unknown as Row;
    this.cache.get(collection)?.set(row.id, row);
    this.bump(collection);
    void this.persist(keyFor(collection, row.id), JSON.stringify(record));
    return record;
  }

  putMany<K extends CollectionName>(collection: K, records: Schema[K][]): Schema[K][] {
    const entries: KeyValueEntry[] = [];
    for (const record of records) {
      const row = record as unknown as Row;
      this.cache.get(collection)?.set(row.id, row);
      entries.push({ key: keyFor(collection, row.id), value: JSON.stringify(record) });
    }
    this.bump(collection);
    void this.persistMany(entries);
    return records;
  }

  /** Aplica uma alteração parcial a um registro existente. */
  patch<K extends CollectionName>(collection: K, id: string, changes: Partial<Schema[K]>): Schema[K] | undefined {
    const current = this.byId(collection, id);
    if (!current) return undefined;
    const next = { ...current, ...changes } as Schema[K];
    return this.put(collection, next);
  }

  remove<K extends CollectionName>(collection: K, id: string): void {
    this.cache.get(collection)?.delete(id);
    this.bump(collection);
    void this.persistDelete(keyFor(collection, id));
  }

  removeMany<K extends CollectionName>(collection: K, ids: string[]): void {
    const bucket = this.cache.get(collection);
    for (const id of ids) bucket?.delete(id);
    this.bump(collection);
    void this.persistDeleteMany(ids.map((id) => keyFor(collection, id)));
  }

  /** Carga em lote de várias coleções (usado pelo seed). */
  async writeBatch(batch: Array<{ collection: CollectionName; records: Row[] }>): Promise<void> {
    const entries: KeyValueEntry[] = [];
    for (const part of batch) {
      const bucket = this.cache.get(part.collection);
      for (const record of part.records) {
        bucket?.set(record.id, record);
        entries.push({ key: keyFor(part.collection, record.id), value: JSON.stringify(record) });
      }
    }
    this.primeIdCounters();
    this.bump();
    this.pending += 1;
    try {
      await this.adapter.setMany(entries);
      this.lastError = null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      this.pending -= 1;
      this.bump();
    }
  }

  /** Apaga tudo da Academia (usado em "restaurar demonstração"). */
  async wipe(): Promise<void> {
    const keys = await this.adapter.keys(DB_PREFIX);
    await this.adapter.deleteMany(keys);
    for (const name of COLLECTIONS) this.cache.get(name)?.clear();
    this.bump();
  }

  // ---------------- persistência ----------------

  private async persist(key: string, value: string): Promise<void> {
    this.pending += 1;
    try {
      await this.adapter.set(key, value);
      this.lastError = null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error("[Academia] falha ao gravar", key, error);
    } finally {
      this.pending -= 1;
      this.bump();
    }
  }

  private async persistMany(entries: KeyValueEntry[]): Promise<void> {
    this.pending += 1;
    try {
      await this.adapter.setMany(entries);
      this.lastError = null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error("[Academia] falha ao gravar lote", error);
    } finally {
      this.pending -= 1;
      this.bump();
    }
  }

  private async persistDelete(key: string): Promise<void> {
    try {
      await this.adapter.delete(key);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  private async persistDeleteMany(keys: string[]): Promise<void> {
    try {
      await this.adapter.deleteMany(keys);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
    }
  }
}

/** Instância única usada por toda a aplicação. */
export const db = new Database();
