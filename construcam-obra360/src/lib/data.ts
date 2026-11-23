"use client";

import { supabase } from "@/lib/supabase";
import type { Condominio, Obra, ObraDetalhada, Unidade } from "@/types";

function db() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

export function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter(Boolean) as string[])];

/** Completa as obras com unidade e condomínio (consultas separadas, juntadas aqui). */
export async function detalharObras(obras: Obra[]): Promise<ObraDetalhada[]> {
  const unidadeIds = uniq(obras.map(o => o.unidade_id));
  const unidades = unidadeIds.length
    ? check(await db().from("unidades").select("id,condominio_id,bloco,identificador").in("id", unidadeIds)) as Unidade[]
    : [];
  const condIds = uniq(unidades.map(u => u.condominio_id));
  const conds = condIds.length
    ? check(await db().from("condominios").select("id,nome,cidade").in("id", condIds)) as Condominio[]
    : [];
  return obras.map(o => {
    const unidade = unidades.find(u => u.id === o.unidade_id) ?? null;
    return { ...o, unidade, condominio: conds.find(c => c.id === unidade?.condominio_id) ?? null };
  });
}

export const OBRA_COLS = "id,unidade_id,descricao,empresa,status,created_at";

export async function obrasPorIds(ids: string[]) {
  if (!ids.length) return [];
  return detalharObras(check(await db().from("obras").select(OBRA_COLS).in("id", ids).order("created_at", { ascending: false })) as Obra[]);
}

export async function obrasPorUnidades(unidadeIds: string[]) {
  if (!unidadeIds.length) return [];
  return detalharObras(check(await db().from("obras").select(OBRA_COLS).in("unidade_id", unidadeIds).order("created_at", { ascending: false })) as Obra[]);
}

export const normalizarEmail = (e: string) => e.trim().toLowerCase();
export const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
