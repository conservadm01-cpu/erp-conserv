"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ID, Row, TableName } from "@/lib/types";
import { getRepo } from "./index";
import { subscribe } from "./events";
import type { Where } from "./repo";

export interface QueryState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Lista linhas de uma tabela e recarrega automaticamente quando a tabela muda. */
export function useRows<T extends TableName>(table: T, where?: Where<T> | null): QueryState<Row<T>[]> {
  const key = where === null ? null : JSON.stringify(where ?? {});
  const [data, setData] = useState<Row<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(() => {
    if (key === null) {
      setData([]);
      setLoading(false);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    getRepo()
      .list(table, JSON.parse(key) as Where<T>)
      .then((rows) => {
        if (mine === seq.current) {
          setData(rows);
          setError(null);
        }
      })
      .catch((e: unknown) => mine === seq.current && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => mine === seq.current && setLoading(false));
  }, [table, key]);

  useEffect(() => {
    load();
    return subscribe(table, load);
  }, [table, load]);

  return { data, loading, error, reload: load };
}

export function useRow<T extends TableName>(table: T, id: ID | null | undefined): QueryState<Row<T> | null> {
  const [data, setData] = useState<Row<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getRepo()
      .get(table, id)
      .then((r) => {
        setData(r);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [table, id]);

  useEffect(() => {
    load();
    return subscribe(table, load);
  }, [table, load]);

  return { data, loading, error, reload: load };
}
