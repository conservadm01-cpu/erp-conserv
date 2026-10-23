"use client";
import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { getRepo } from "@/lib/data";
import { analyzeExperiences } from "@/lib/guide/analyze";
import type { PlaceCategory } from "@/lib/providers/types";
import type { Trip } from "@/lib/types";
import { GUIDE_CATEGORIES } from "./guide-panel";

const PACE_LABEL = { tranquilo: "Tranquilo", moderado: "Moderado", intenso: "Intenso" };

export function ExperiencePanel({ trip, onExplore }: { trip: Trip; onExplore: (c: PlaceCategory) => void }) {
  const toast = useToast();
  const [text, setText] = useState(trip.desired_experiences ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setText(trip.desired_experiences ?? ""), [trip.id, trip.desired_experiences]);
  const a = useMemo(() => analyzeExperiences(text, { children: trip.children, pace: trip.pace }), [text, trip.children, trip.pace]);
  const dirty = text !== (trip.desired_experiences ?? "");

  async function save() {
    setSaving(true);
    try {
      await getRepo().update("trips", trip.id, { desired_experiences: text.slice(0, 4000) });
      toast("Experiências desejadas salvas na viagem.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <Card>
        <CardHeader title="Que experiências vocês desejam?" subtitle="Descreva livremente: sabores, lugares, sensações, quem viaja, o que não pode faltar." />
        <CardBody className="space-y-3">
          <Field label="Experiências desejadas" hint={`${text.length}/4000 caracteres`}>
            {(p) => (
              <Textarea
                {...p}
                value={text}
                maxLength={4000}
                onChange={(e) => setText(e.target.value)}
                className="min-h-56"
                placeholder="Ex.: Queremos provar a culinária típica, visitar uma catedral histórica, ver o pôr do sol em um mirante e caminhar sem pressa, porque viajamos com uma criança de 8 anos."
              />
            )}
          </Field>
          <div className="flex justify-end">
            <Button onClick={save} loading={saving} disabled={!dirty}>
              Salvar na viagem
            </Button>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><Sparkles className="h-5 w-5 text-sunset-500" aria-hidden /> Análise do seu guia</span>} subtitle={a.label} />
        <CardBody className="space-y-4">
          {a.empty ? (
            <Notice tone="info">Escreva ao lado e a análise aparece aqui na hora.</Notice>
          ) : (
            <>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Interesses identificados</h3>
                {a.interests.length ? (
                  <ul className="space-y-2">
                    {a.interests.map((i) => (
                      <li key={i.key} className="rounded-xl border border-line p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{i.label}</span>
                          <span className="text-xs text-muted">por: {i.matched.slice(0, 4).join(", ")}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted">{i.tips[0]}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">Nenhum interesse reconhecido ainda — tente citar comidas, lugares ou atividades.</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">Ritmo sugerido:</span>
                <Badge tone="blue">{PACE_LABEL[a.pace.suggested]}</Badge>
                <span className="text-muted">{a.pace.reason}</span>
              </div>
              {a.place_categories.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Explorar no guia local</h3>
                  <div className="flex flex-wrap gap-2">
                    {a.place_categories.map((c) => {
                      const def = GUIDE_CATEGORIES.find((g) => g.value === c)!;
                      return (
                        <Button key={c} size="sm" variant="secondary" onClick={() => onExplore(c)}>
                          <def.icon className="h-4 w-4" aria-hidden /> {def.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
          <div>
            <h3 className="mb-2 text-sm font-semibold">Perguntas para refinar</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              {a.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
