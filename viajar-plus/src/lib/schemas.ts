import { z } from "zod";

// Esquemas compartilhados entre formulários (cliente) e rotas de API (servidor).

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const money = z.coerce.number({ message: "Informe um número" }).min(0, "Não pode ser negativo").max(100_000_000, "Valor muito alto");
const currency = z.string().regex(/^[A-Z]{3}$/, "Moeda inválida (ex.: BRL)");

export const tripSchema = z
  .object({
    name: z.string().trim().min(2, "Dê um nome à viagem").max(120),
    destination: z.string().trim().min(2, "Informe o destino").max(160),
    destination_country: z.string().trim().max(80).default(""),
    origin: z.string().trim().min(2, "Informe a origem").max(160),
    start_date: isoDate,
    end_date: isoDate,
    adults: z.coerce.number().int().min(1, "Pelo menos 1 adulto").max(50),
    children: z.coerce.number().int().min(0).max(50),
    children_ages: z.array(z.coerce.number().int().min(0, "Idade inválida").max(17, "Criança: até 17 anos")).default([]),
    currency,
    budget_total: money,
    budget_per_person: money,
    transport_prefs: z.array(z.string()).default([]),
    lodging_prefs: z.array(z.string()).default([]),
    activity_prefs: z.array(z.string()).default([]),
    pace: z.enum(["tranquilo", "moderado", "intenso"]),
    accessibility: z.string().max(1000).default(""),
    restrictions: z.string().max(1000).default(""),
    notes: z.string().max(4000).default(""),
    desired_experiences: z.string().max(4000).default(""),
    status: z.enum(["planejando", "reservada", "em_andamento", "concluida"]),
  })
  .refine((t) => t.end_date >= t.start_date, { path: ["end_date"], message: "A volta deve ser no mesmo dia ou depois da ida" })
  .refine((t) => t.children_ages.length === t.children, { path: ["children_ages"], message: "Informe a idade de cada criança" });

export type TripInput = z.infer<typeof tripSchema>;

export const expenseSchema = z
  .object({
    category_key: z.string().min(1, "Escolha a categoria"),
    description: z.string().trim().min(2, "Descreva o item").max(200),
    supplier: z.string().trim().max(160).default(""),
    quantity: z.coerce.number().min(0, "Quantidade inválida").max(100_000),
    unit_price: money,
    original_currency: currency,
    fx_rate: z.coerce.number().positive("Câmbio deve ser maior que zero").max(1_000_000),
    fees: money,
    planned_amount: money,
    quoted_amount: money,
    reserved_amount: money,
    due_date: isoDate.nullable().or(z.literal("").transform(() => null)),
    responsible_traveler_id: z.string().nullable().or(z.literal("").transform(() => null)),
    status: z.enum(["previsto", "cotado", "reservado", "parcial", "pago", "cancelado"]),
    notes: z.string().max(2000).default(""),
    split_mode: z.enum(["todos", "selecionados", "personalizado", "individual"]),
    split: z.record(z.string(), z.coerce.number().min(0)).default({}),
  })
  .refine((e) => e.split_mode === "todos" || Object.values(e.split).some((w) => w > 0), {
    path: ["split"],
    message: "Selecione ao menos um participante para o rateio",
  });

export type ExpenseInput = z.infer<typeof expenseSchema>;

export const paymentSchema = z.object({
  kind: z.enum(["pagamento", "estorno"]),
  amount: z.coerce.number().positive("Informe um valor maior que zero").max(100_000_000),
  currency,
  fx_rate: z.coerce.number().positive("Câmbio deve ser maior que zero"),
  paid_at: isoDate,
  payer_traveler_id: z.string().nullable().or(z.literal("").transform(() => null)),
  method: z.enum(["pix", "cartao", "dinheiro", "transferencia", "boleto", "outro"]),
  notes: z.string().max(1000).default(""),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

export const manualQuoteSchema = z.object({
  type: z.enum(["voo", "hospedagem", "carro", "passeio", "outro"]),
  title: z.string().trim().min(2, "Descreva a cotação").max(200),
  provider_name: z.string().trim().min(2, "Informe a fonte/fornecedor").max(160),
  url: z.union([z.literal(""), z.url("URL inválida").refine((u) => /^https?:\/\//i.test(u), "Use http(s)")]),
  total_price: z.coerce.number().positive("Informe o preço total"),
  currency,
  fx_rate: z.coerce.number().positive(),
  travelers_count: z.coerce.number().int().min(1),
  units: z.coerce.number().int().min(1),
  captured_at: z.string().min(10, "Informe data e hora em que o preço foi visto"),
  valid_until: z.string().nullable().or(z.literal("").transform(() => null)),
  search_key: z.string().max(200).default(""),
  notes: z.string().max(2000).default(""),
});

export type ManualQuoteInput = z.infer<typeof manualQuoteSchema>;

export const reservationSchema = z.object({
  type: z.enum(["voo", "hospedagem", "carro", "passeio", "outro"]),
  title: z.string().trim().min(2, "Informe o título").max(200),
  provider_name: z.string().trim().max(160).default(""),
  confirmation_code: z.string().trim().max(80).default(""),
  start_at: z.string().nullable().or(z.literal("").transform(() => null)),
  end_at: z.string().nullable().or(z.literal("").transform(() => null)),
  cancellation_policy: z.string().max(2000).default(""),
  cancel_deadline: z.string().nullable().or(z.literal("").transform(() => null)),
  amount: money,
  currency,
  status: z.enum(["pendente", "confirmada", "cancelada", "concluida"]),
  url: z.union([z.literal(""), z.url("URL inválida").refine((u) => /^https?:\/\//i.test(u), "Use http(s)")]),
  notes: z.string().max(2000).default(""),
});

export type ReservationInput = z.infer<typeof reservationSchema>;

export const diarySchema = z.object({
  date: isoDate,
  title: z.string().trim().min(1, "Dê um título").max(160),
  body: z.string().max(20000).default(""),
  location_name: z.string().max(200).default(""),
  rating: z.coerce.number().int().min(1).max(5).nullable(),
  mood: z.string().max(40).default(""),
  tags: z.array(z.string().max(40)).default([]),
  people: z.array(z.string().max(80)).default([]),
  author_traveler_id: z.string().nullable(),
  instagrammable: z.boolean().default(false),
});

export type DiaryInput = z.infer<typeof diarySchema>;
