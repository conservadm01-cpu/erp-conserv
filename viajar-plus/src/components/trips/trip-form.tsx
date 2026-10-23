"use client";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { tripSchema, type TripInput } from "@/lib/schemas";
import { Field, Input, Select, Textarea, ChipGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CURRENCIES } from "@/lib/format";
import { ACTIVITY_OPTIONS, LODGING_OPTIONS, TRANSPORT_OPTIONS } from "./options";

type FormIn = z.input<typeof tripSchema>;

export const EMPTY_TRIP: TripInput = {
  name: "",
  destination: "",
  destination_country: "",
  origin: "",
  start_date: "",
  end_date: "",
  adults: 2,
  children: 0,
  children_ages: [],
  currency: "BRL",
  budget_total: 0,
  budget_per_person: 0,
  transport_prefs: [],
  lodging_prefs: [],
  activity_prefs: [],
  pace: "moderado",
  accessibility: "",
  restrictions: "",
  notes: "",
  desired_experiences: "",
  status: "planejando",
};

export function TripForm({ initial, submitLabel, onSubmit }: { initial: TripInput; submitLabel: string; onSubmit: (v: TripInput) => Promise<void> }) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, TripInput>({ resolver: zodResolver(tripSchema), defaultValues: initial });

  const children = Number(useWatch({ control, name: "children" }) ?? 0);
  const adults = Number(useWatch({ control, name: "adults" }) ?? 0);

  // Mantém um campo de idade por criança
  useEffect(() => {
    const ages = (getValues("children_ages") as number[] | undefined) ?? [];
    if (ages.length !== children) {
      setValue("children_ages", Array.from({ length: Math.max(0, children) }, (_, i) => ages[i] ?? 0));
    }
  }, [children, getValues, setValue]);

  const people = Math.max(1, adults + children);
  const syncPerPerson = (total: number) => setValue("budget_per_person", Math.round((total / people) * 100) / 100);
  const syncTotal = (per: number) => setValue("budget_total", Math.round(per * people * 100) / 100);

  const err = (k: keyof TripInput) => (errors[k]?.message as string | undefined) ?? undefined;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <Card>
        <CardHeader title="Destino e datas" />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Field label="Nome da viagem" error={err("name")} className="md:col-span-2">
            {(p) => <Input {...p} {...register("name")} placeholder="Ex.: Férias na Patagônia" />}
          </Field>
          <Field label="Destino" error={err("destination")}>
            {(p) => <Input {...p} {...register("destination")} placeholder="Cidade ou região" />}
          </Field>
          <Field label="País" error={err("destination_country")}>
            {(p) => <Input {...p} {...register("destination_country")} />}
          </Field>
          <Field label="Origem" error={err("origin")} className="md:col-span-2">
            {(p) => <Input {...p} {...register("origin")} placeholder="Cidade/aeroporto de saída" />}
          </Field>
          <Field label="Ida" error={err("start_date")}>
            {(p) => <Input type="date" {...p} {...register("start_date")} />}
          </Field>
          <Field label="Volta" error={err("end_date")}>
            {(p) => <Input type="date" {...p} {...register("end_date")} />}
          </Field>
          <Field label="Status" error={err("status")}>
            {(p) => (
              <Select {...p} {...register("status")}>
                <option value="planejando">Planejando</option>
                <option value="reservada">Reservada</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluida">Concluída</option>
              </Select>
            )}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Viajantes e orçamento" />
        <CardBody className="grid gap-4 md:grid-cols-3">
          <Field label="Adultos" error={err("adults")}>
            {(p) => <Input type="number" min={1} {...p} {...register("adults")} />}
          </Field>
          <Field label="Crianças" error={err("children")}>
            {(p) => <Input type="number" min={0} {...p} {...register("children")} />}
          </Field>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Idade das crianças</span>
            <div className="flex flex-wrap gap-2">
              {children === 0 && <span className="text-sm text-muted">—</span>}
              {Array.from({ length: children }).map((_, i) => (
                <Input key={i} type="number" min={0} max={17} aria-label={`Idade da criança ${i + 1}`} className="w-20" {...register(`children_ages.${i}` as const)} />
              ))}
            </div>
            {errors.children_ages && <p role="alert" className="text-xs text-red-600">{(errors.children_ages.message as string) ?? "Idades inválidas"}</p>}
          </div>
          <Field label="Moeda base" error={err("currency")}>
            {(p) => (
              <Select {...p} {...register("currency")}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Orçamento total" error={err("budget_total")}>
            {(p) => <Input type="number" step="0.01" min={0} {...p} {...register("budget_total", { onChange: (e) => syncPerPerson(Number(e.target.value) || 0) })} />}
          </Field>
          <Field label={`Por pessoa (${people} viajantes)`} error={err("budget_per_person")}>
            {(p) => <Input type="number" step="0.01" min={0} {...p} {...register("budget_per_person", { onChange: (e) => syncTotal(Number(e.target.value) || 0) })} />}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Preferências e estilo" />
        <CardBody className="space-y-5">
          <div className="space-y-2">
            <div className="text-sm font-medium">Transporte</div>
            <Controller control={control} name="transport_prefs" render={({ field }) => <ChipGroup label="Transporte" options={TRANSPORT_OPTIONS} value={(field.value as string[]) ?? []} onChange={field.onChange} />} />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Hospedagem</div>
            <Controller control={control} name="lodging_prefs" render={({ field }) => <ChipGroup label="Hospedagem" options={LODGING_OPTIONS} value={(field.value as string[]) ?? []} onChange={field.onChange} />} />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Passeios e interesses</div>
            <Controller control={control} name="activity_prefs" render={({ field }) => <ChipGroup label="Interesses" options={ACTIVITY_OPTIONS} value={(field.value as string[]) ?? []} onChange={field.onChange} />} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Ritmo da viagem">
              {(p) => (
                <Select {...p} {...register("pace")}>
                  <option value="tranquilo">Tranquilo</option>
                  <option value="moderado">Moderado</option>
                  <option value="intenso">Intenso</option>
                </Select>
              )}
            </Field>
            <Field label="Acessibilidade" className="md:col-span-2">
              {(p) => <Input {...p} {...register("accessibility")} placeholder="Ex.: cadeira de rodas, mobilidade reduzida" />}
            </Field>
          </div>
          <Field label="Restrições (alimentares, saúde, medos…)">
            {(p) => <Textarea {...p} {...register("restrictions")} />}
          </Field>
          <Field label="Experiências desejadas" hint="Descreva livremente o que vocês sonham viver. O guia analisa este texto e sugere restaurantes, bares, locais religiosos, mirantes e passeios.">
            {(p) => <Textarea {...p} rows={4} {...register("desired_experiences")} placeholder="Ex.: provar a comida típica, conhecer igrejas históricas, ver o pôr do sol num mirante…" />}
          </Field>
          <Field label="Observações">
            {(p) => <Textarea {...p} {...register("notes")} />}
          </Field>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" size="lg" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
