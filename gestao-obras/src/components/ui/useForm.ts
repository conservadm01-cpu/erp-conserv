"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";

/** Estado padrão de envio de formulários: carregamento, erro geral e erros por campo. */
export function useSubmit() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.correlationId && e.status >= 500 ? `${e.message} (código ${e.correlationId})` : e.message);
        setFieldErrors(e.fieldErrors);
      } else {
        setError("Erro inesperado.");
      }
      return undefined;
    } finally {
      setPending(false);
    }
  }

  return { pending, error, fieldErrors, run, setError };
}
