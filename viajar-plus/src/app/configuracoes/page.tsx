"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Database, Download, LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/dialog";
import { Notice, PageHeader } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { IntegrationsStatus } from "@/components/settings/integrations-status";
import { dataMode } from "@/lib/data";
import { CURRENCIES } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import { DEFAULT_CURRENCY_KEY, DELETE_CONFIRMATION, DISPLAY_NAME_KEY, KEEP_LOCATION_KEY, SHARE_MEDIA_KEY } from "@/lib/privacy/constants";
import { deleteLocalData, downloadBlob, exportLocalData } from "@/lib/privacy/local-export";

function readLs(key: string, fallback = ""): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeLs(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export default function SettingsPage() {
  const mode = dataMode();
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [keepLocation, setKeepLocation] = useState(false);
  const [shareMedia, setShareMedia] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setName(readLs(DISPLAY_NAME_KEY));
    setCurrency(readLs(DEFAULT_CURRENCY_KEY, "BRL"));
    setKeepLocation(readLs(KEEP_LOCATION_KEY) === "1");
    setShareMedia(readLs(SHARE_MEDIA_KEY) === "1");
    if (mode === "supabase") {
      const sb = supabaseBrowser();
      sb.auth.getUser().then(async ({ data }) => {
        if (!data.user) return;
        setEmail(data.user.email ?? null);
        const { data: p } = await sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
        if (p) {
          setName(p.display_name ?? "");
          setCurrency(p.currency ?? "BRL");
          setKeepLocation(Boolean(p.consent_location));
          setShareMedia(Boolean(p.consent_share_media));
        }
      });
    }
  }, [mode]);

  async function saveProfile() {
    setBusy(true);
    try {
      writeLs(DISPLAY_NAME_KEY, name);
      writeLs(DEFAULT_CURRENCY_KEY, currency);
      writeLs(KEEP_LOCATION_KEY, keepLocation ? "1" : "0");
      writeLs(SHARE_MEDIA_KEY, shareMedia ? "1" : "0");
      if (mode === "supabase") {
        const sb = supabaseBrowser();
        const { data } = await sb.auth.getUser();
        if (data.user) {
          const { error } = await sb
            .from("profiles")
            .update({ display_name: name, currency, consent_location: keepLocation, consent_share_media: shareMedia })
            .eq("id", data.user.id);
          if (error) throw new Error(error.message);
        }
      }
      toast("Preferências salvas.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao salvar", "error");
    } finally {
      setBusy(false);
    }
  }

  async function exportData() {
    setBusy(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      if (mode === "local") {
        downloadBlob(await exportLocalData(), `viajar-plus-meus-dados-${stamp}.json`);
      } else {
        const res = await fetch("/api/account/export");
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Falha na exportação");
        downloadBlob(await res.blob(), `viajar-plus-meus-dados-${stamp}.json`);
      }
      toast("Exportação gerada.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha na exportação", "error");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    window.location.assign("/login");
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Conta e privacidade" title="Configurações" description="Perfil, aparência, consentimentos, integrações e controle dos seus dados." />

      <Card>
        <CardHeader
          title="Modo de dados"
          action={
            mode === "supabase" && email ? (
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            ) : undefined
          }
        />
        <CardBody className="flex items-start gap-3">
          <Database className="mt-0.5 h-5 w-5 text-accent" aria-hidden />
          {mode === "supabase" ? (
            <p className="text-sm">
              Nuvem (Supabase) com login{email ? <> — conectado como <strong>{email}</strong></> : null}. Acesso protegido por políticas RLS; mídia em buckets privados com URLs assinadas temporárias.
            </p>
          ) : (
            <p className="text-sm">
              Demonstração local: tudo fica no IndexedDB deste navegador, sem login nem sincronização. Limpar os dados do navegador apaga as viagens. Configure o Supabase (docs/SUPABASE.md) para usar em vários aparelhos e convidar familiares.
            </p>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Perfil e preferências" />
          <CardBody className="space-y-4">
            <Field label="Nome de exibição">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />}</Field>
            <Field label="Moeda padrão para novas viagens" hint="Cada viagem tem sua moeda base; a moeda de exibição pode ser trocada no topo da tela.">
              {(p) => (
                <Select {...p} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Tema">
              {(p) => (
                <Select {...p} value={mounted ? (theme ?? "system") : "system"} onChange={(e) => setTheme(e.target.value)}>
                  <option value="system">Automático (sistema)</option>
                  <option value="light">Claro</option>
                  <option value="dark">Escuro</option>
                </Select>
              )}
            </Field>
            <Field label="Idioma">{(p) => <Input {...p} value="Português (Brasil)" disabled />}</Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Consentimentos" subtitle="Nada é compartilhado sem sua autorização." />
          <CardBody className="space-y-4">
            <div>
              <Checkbox checked={keepLocation} onChange={(e) => setKeepLocation(e.target.checked)} label="Guardar a localização (GPS) das fotos enviadas" />
              <p className="ml-6 mt-1 text-xs text-muted">Desligado por padrão: as coordenadas do EXIF são descartadas no envio. Ligado, elas alimentam o mapa de memórias.</p>
            </div>
            <div>
              <Checkbox checked={shareMedia} onChange={(e) => setShareMedia(e.target.checked)} label="Permitir que participantes da viagem vejam minhas fotos e vídeos" />
              <p className="ml-6 mt-1 text-xs text-muted">Fotos nunca são públicas. Mesmo com esta opção, só membros aceitos da viagem com acesso à mídia podem vê-las.</p>
            </div>
            <Button onClick={saveProfile} loading={busy}>Salvar preferências</Button>
          </CardBody>
        </Card>
      </div>

      <IntegrationsStatus />

      <Card>
        <CardHeader title="Seus dados (LGPD)" subtitle="Portabilidade e eliminação, conforme a Lei 13.709/2018." />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={exportData} loading={busy}>
              <Download className="h-4 w-4" /> Exportar meus dados (JSON)
            </Button>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> {mode === "local" ? "Apagar todos os dados deste navegador" : "Excluir minha conta e dados"}
            </Button>
          </div>
          <p className="text-xs text-muted">
            A exclusão remove viagens das quais você é dono, com orçamento, diário, fotos, vídeos e documentos. Nas viagens de outras pessoas, apenas seu vínculo é removido. Esta ação não pode ser desfeita.
          </p>
        </CardBody>
      </Card>

      <DeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} mode={mode} />
    </div>
  );
}

function DeleteDialog({ open, onOpenChange, mode }: { open: boolean; onOpenChange: (v: boolean) => void; mode: "local" | "supabase" }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "local") {
        await deleteLocalData();
        window.location.assign("/");
        return;
      }
      const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: text }) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao excluir");
      window.location.assign("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Excluir dados definitivamente" description="Recomendamos exportar seus dados antes.">
      <div className="space-y-4">
        <Notice tone="warn">Esta ação apaga permanentemente suas viagens, fotos, vídeos, documentos e registros financeiros.</Notice>
        <Field label={<>Para confirmar, digite <strong>{DELETE_CONFIRMATION}</strong></>}>
          {(p) => <Input {...p} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />}
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="danger" disabled={text !== DELETE_CONFIRMATION} loading={busy} onClick={confirm}>Excluir definitivamente</Button>
        </div>
      </div>
    </Modal>
  );
}
