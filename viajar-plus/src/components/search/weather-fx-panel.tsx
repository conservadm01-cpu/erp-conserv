"use client";
import { useState } from "react";
import { CloudSun, RefreshCw, Sunrise, Sunset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { CURRENCIES, fmtDate, fmtDateTime, money } from "@/lib/format";
import type { WeatherResult } from "@/lib/providers/types";
import { getProvider } from "@/lib/search/client";
import type { Trip } from "@/lib/types";
import { useTripCoords } from "./use-trip-coords";

export function WeatherFxPanel({ trip }: { trip: Trip }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <WeatherCard trip={trip} />
      <FxCard trip={trip} />
    </div>
  );
}

function WeatherCard({ trip }: { trip: Trip }) {
  const { coords, locate } = useTripCoords(trip);
  const [w, setW] = useState<{ result: WeatherResult; attribution: string; queried_at: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const at = coords ?? (await locate());
      if (!at) throw new Error("Destino sem localização no mapa.");
      const r = await getProvider<WeatherResult>("/api/weather", { lat: at.lat, lng: at.lng, start_date: trip.start_date, end_date: trip.end_date });
      setW({ result: r.results[0], attribution: r.attribution, queried_at: r.queried_at });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }
  const t = (iso: string | null) => (iso ? iso.slice(11, 16) : "—");

  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><CloudSun className="h-5 w-5" aria-hidden /> Clima em {trip.destination}</span>}
        subtitle={`${fmtDate(trip.start_date)} a ${fmtDate(trip.end_date)}`}
        action={<Button size="sm" onClick={load} loading={loading}>{w ? "Atualizar" : "Consultar clima"}</Button>}
      />
      <CardBody className="space-y-3">
        {error && <Notice tone="error">{error}</Notice>}
        {!w && !error && <p className="text-sm text-muted">A previsão só existe para os próximos 16 dias. Para datas mais distantes mostramos o tempo registrado no mesmo período do ano anterior, claramente marcado como histórico.</p>}
        {w && (
          <>
            <Notice tone={w.result.kind === "previsao" ? "info" : "warn"}>{w.result.label}</Notice>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="py-1">Dia</th>
                    <th>Máx/Mín</th>
                    <th>Chuva</th>
                    <th>Vento máx.</th>
                    <th>
                      <Sunrise className="inline h-3.5 w-3.5" aria-label="Nascer do sol" />
                    </th>
                    <th>
                      <Sunset className="inline h-3.5 w-3.5" aria-label="Pôr do sol" />
                    </th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {w.result.days.map((d) => (
                    <tr key={d.date} className="border-t border-line">
                      <td className="py-1.5">{fmtDate(d.date, { weekday: "short", day: "2-digit", month: "short", year: w.result.kind === "historico" ? "numeric" : undefined })}</td>
                      <td>
                        {d.t_max ?? "—"}° / {d.t_min ?? "—"}°
                      </td>
                      <td>{d.precipitation_mm ?? "—"} mm</td>
                      <td>{d.wind_max_kmh ?? "—"} km/h</td>
                      <td>{t(d.sunrise)}</td>
                      <td>{t(d.sunset)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">
              Fotos: a “hora dourada” acontece logo após o nascer e cerca de 1 hora antes do pôr do sol. {w.attribution} · consultado em {fmtDateTime(w.queried_at)}
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function FxCard({ trip }: { trip: Trip }) {
  const [from, setFrom] = useState(trip.currency === "BRL" ? "ARS" : "BRL");
  const [amount, setAmount] = useState("100");
  const [r, setR] = useState<{ rate: number; source: string; fetched_at: string; rate_date?: string; attribution?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fx?base=${from}&symbols=${trip.currency}`);
      const json = (await res.json()) as { rates?: Record<string, number>; source?: string; fetched_at?: string; rate_date?: string; attribution?: string; error?: string };
      if (!res.ok || !json.rates?.[trip.currency]) throw new Error(json.error ?? "Câmbio indisponível");
      setR({ rate: json.rates[trip.currency], source: json.source ?? "", fetched_at: json.fetched_at ?? "", rate_date: json.rate_date, attribution: json.attribution });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Câmbio de referência" subtitle={`Converter para ${trip.currency}`} />
      <CardBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor">{(p) => <Input {...p} type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
          <Field label="Moeda">
            {(p) => (
              <Select {...p} value={from} onChange={(e) => { setFrom(e.target.value); setR(null); }}>
                {CURRENCIES.filter((c) => c !== trip.currency).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Button onClick={load} loading={loading} variant="outline">
          <RefreshCw className="h-4 w-4" aria-hidden /> Consultar câmbio
        </Button>
        {error && <Notice tone="error">{error}</Notice>}
        {r && (
          <div className="rounded-xl bg-surface-2 p-3">
            <div className="text-2xl font-bold tabular-nums">{money((Number(amount) || 0) * r.rate, trip.currency)}</div>
            <div className="text-sm text-muted">
              1 {from} = {r.rate.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} {trip.currency}
            </div>
            <p className="mt-2 text-xs text-muted">
              {r.source} · referência de {r.rate_date ?? "—"} · consultado em {fmtDateTime(r.fetched_at)}. Taxa de referência: cartão e casas de câmbio cobram spread e impostos (IOF). {r.attribution}
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
