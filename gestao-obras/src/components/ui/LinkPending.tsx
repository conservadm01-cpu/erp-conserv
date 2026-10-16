"use client";

import { useLinkStatus } from "next/link";

/**
 * Indicador de carregamento da navegação, exibido dentro do link clicado.
 * Substitui o loading.tsx por rota, cuja fronteira de Suspense fazia o roteador
 * descartar navegações iniciadas logo após outra (ex.: trocar de aba ao abrir a obra).
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span aria-hidden={!pending} className={`ml-1.5 inline-block h-3 w-3 rounded-full border-2 border-current border-r-transparent align-[-1px] ${pending ? "animate-spin opacity-70" : "opacity-0"}`}>
      {pending && <span className="sr-only">Carregando…</span>}
    </span>
  );
}
