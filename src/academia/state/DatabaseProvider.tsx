import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "../data/db";
import { isSeeded, runSeed } from "../data/seed";

interface BootState {
  phase: "loading" | "seeding" | "ready" | "error";
  message: string;
  error?: string;
  reload: () => void;
  reseed: () => Promise<void>;
}

const BootContext = createContext<BootState | null>(null);

/**
 * Abre o banco (1 requisição em lote), aplica a carga inicial quando
 * estiver vazio e libera a aplicação.
 */
export function DatabaseProvider({ children, fallback }: { children: React.ReactNode; fallback: (state: BootState) => React.ReactNode }) {
  const [phase, setPhase] = useState<BootState["phase"]>("loading");
  const [message, setMessage] = useState("Abrindo a Academia…");
  const [error, setError] = useState<string | undefined>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setPhase("loading");
        setMessage("Carregando conteúdo da Academia…");
        await db.load();
        if (cancelled) return;
        if (!isSeeded()) {
          setPhase("seeding");
          setMessage("Preparando cursos, trilhas e conteúdos iniciais…");
          await runSeed();
        }
        if (cancelled) return;
        setPhase("ready");
        setMessage("Pronto");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const state: BootState = {
    phase,
    message,
    error,
    reload: () => setAttempt((n) => n + 1),
    reseed: async () => {
      setPhase("seeding");
      setMessage("Recriando a demonstração…");
      await runSeed({ force: true });
      setPhase("ready");
    },
  };

  return (
    <BootContext.Provider value={state}>
      {phase === "ready" ? children : fallback(state)}
    </BootContext.Provider>
  );
}

export function useBoot(): BootState {
  const value = useContext(BootContext);
  if (!value) throw new Error("useBoot precisa estar dentro de <DatabaseProvider>");
  return value;
}
