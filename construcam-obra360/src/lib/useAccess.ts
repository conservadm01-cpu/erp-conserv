"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Membro } from "@/types";

export type Access = {
  loading: boolean; error: string;
  platformAdmin: boolean;
  adminCondos: string[]; ownerUnits: string[]; workerObras: string[];
  reload: () => void;
};

/** Papéis do usuário logado, a partir do e-mail (tabelas plataforma_admins e membros). */
export function useAccess(user: User | null): Access {
  const [state, setState] = useState<Omit<Access, "reload">>({
    loading: true, error: "", platformAdmin: false, adminCondos: [], ownerUnits: [], workerObras: []
  });

  const load = useCallback(async () => {
    if (!supabase || !user?.email) { setState(s => ({ ...s, loading: false })); return; }
    const email = user.email.toLowerCase();
    const [pa, mb] = await Promise.all([
      supabase.from("plataforma_admins").select("email").eq("email", email),
      supabase.from("membros").select("id,email,nome,papel,condominio_id,unidade_id,obra_id").eq("email", email)
    ]);
    if (pa.error || mb.error) {
      const msg = (pa.error ?? mb.error)!.message;
      setState(s => ({ ...s, loading: false, error: /does not exist|schema cache/i.test(msg)
        ? "O banco ainda não tem as tabelas de acesso. Rode supabase/003_condominios_acessos.sql no Supabase." : msg }));
      return;
    }
    const membros = (mb.data ?? []) as Membro[];
    setState({
      loading: false, error: "",
      platformAdmin: (pa.data ?? []).length > 0,
      adminCondos: membros.filter(m => m.papel === "admin").map(m => m.condominio_id!),
      ownerUnits: membros.filter(m => m.papel === "proprietario").map(m => m.unidade_id!),
      workerObras: membros.filter(m => m.papel === "profissional").map(m => m.obra_id!)
    });
  }, [user?.email]);

  useEffect(() => { void load(); }, [load]);
  return { ...state, reload: () => void load() };
}
