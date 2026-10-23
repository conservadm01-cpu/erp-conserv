// Modelo de domínio do VIAJAR+.
// Os nomes dos campos seguem as colunas SQL (snake_case) de supabase/migrations,
// para que a mesma linha sirva ao Supabase e ao modo demonstração local.

export type ID = string;
export type ISODate = string; // "2026-12-10"
export type ISODateTime = string; // "2026-12-10T08:30:00.000Z"
export type CurrencyCode = string; // ISO 4217: "BRL", "ARS", "USD"...

export interface Timestamps {
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Profile extends Timestamps {
  id: ID; // = auth.users.id
  display_name: string;
  locale: string;
  currency: CurrencyCode;
  consent_location: boolean;
  consent_share_media: boolean;
  accepted_terms_at: ISODateTime | null;
}

export type TripStatus = "planejando" | "reservada" | "em_andamento" | "concluida";
export type TripPace = "tranquilo" | "moderado" | "intenso";

export interface Trip extends Timestamps {
  id: ID;
  owner_id: ID;
  name: string;
  destination: string;
  destination_country: string;
  destination_lat: number | null;
  destination_lng: number | null;
  origin: string;
  start_date: ISODate;
  end_date: ISODate;
  adults: number;
  children: number;
  children_ages: number[];
  currency: CurrencyCode; // moeda base do orçamento
  budget_total: number;
  budget_per_person: number;
  transport_prefs: string[];
  lodging_prefs: string[];
  activity_prefs: string[];
  pace: TripPace;
  accessibility: string;
  restrictions: string;
  notes: string;
  desired_experiences: string; // campo de análise de experiências desejadas
  status: TripStatus;
  cover_media_id: ID | null;
  is_demo: boolean;
}

export type MemberRole = "proprietario" | "editor" | "financeiro" | "colaborador" | "leitor";

export interface MemberPermissions {
  edit_trip: boolean;
  budget: boolean;
  reservations: boolean;
  diary: boolean;
  media: boolean;
}

export interface TripMember extends Timestamps {
  id: ID;
  trip_id: ID;
  user_id: ID | null;
  name: string;
  email: string;
  role: MemberRole;
  permissions: MemberPermissions;
  invite_status: "convidado" | "aceito" | "recusado";
  invite_token: string | null;
}

export interface Destination extends Timestamps {
  id: ID;
  trip_id: ID;
  name: string;
  country: string;
  lat: number | null;
  lng: number | null;
  position: number;
}

export interface Traveler extends Timestamps {
  id: ID;
  trip_id: ID;
  name: string;
  kind: "adulto" | "crianca";
  age: number | null;
  member_id: ID | null;
  responsibilities: string; // ex.: "Reservas e carro"
}

// ---------- Pesquisa, fornecedores e cotações ----------

export type QuoteType = "voo" | "hospedagem" | "carro" | "passeio" | "outro";
export type QuoteSource = "api" | "manual" | "demo";

export interface Provider extends Timestamps {
  id: ID;
  key: string;
  name: string;
  type: QuoteType | "dados";
  website: string;
  notes: string;
}

export interface SearchQuery extends Timestamps {
  id: ID;
  trip_id: ID;
  type: QuoteType | "lugares";
  provider: string;
  params: Record<string, unknown>;
  results_count: number;
  status: "ok" | "erro" | "indisponivel";
  error_message: string | null;
}

export interface Quote extends Timestamps {
  id: ID;
  trip_id: ID;
  type: QuoteType;
  title: string;
  provider_name: string;
  source: QuoteSource;
  url: string;
  total_price: number; // na moeda original
  currency: CurrencyCode;
  fx_rate: number; // moeda original -> moeda base da viagem
  travelers_count: number;
  units: number; // noites (hospedagem), diárias (carro), 1 (voo/passeio)
  captured_at: ISODateTime; // momento da consulta
  valid_until: ISODateTime | null;
  search_key: string; // agrupa cotações comparáveis (mesma rota/datas)
  details: Record<string, unknown>;
  status: "ativa" | "descartada" | "convertida";
  expense_id: ID | null;
  notes: string;
}

export interface FlightSegment {
  carrier: string;
  flight_number: string;
  from: string;
  to: string;
  depart_at: ISODateTime;
  arrive_at: ISODateTime;
}

export interface FlightOption {
  id: string;
  provider: string;
  carrier_names: string[];
  segments: FlightSegment[];
  outbound_duration_min: number;
  stops: number;
  cabin: string;
  baggage_included: string; // texto informado pela fonte
  fare_rules: string;
  total_price: number;
  currency: CurrencyCode;
  price_per_person: number;
  booking_url: string;
  queried_at: ISODateTime;
}

export interface LodgingOption {
  id: string;
  provider: string;
  name: string;
  kind: "hotel" | "apartamento" | "casa" | "pousada" | "outro";
  address: string;
  lat: number | null;
  lng: number | null;
  total_price: number | null;
  taxes_included: boolean | null;
  currency: CurrencyCode;
  breakfast: boolean | null;
  kitchen: boolean | null;
  parking: boolean | null;
  cancellation: string;
  rating: number | null;
  distance_center_km: number | null;
  photos: string[];
  booking_url: string;
  availability_confirmed: boolean;
  queried_at: ISODateTime;
}

export interface RentalOption {
  id: string;
  provider: string;
  vendor: string;
  category: string;
  transmission: "manual" | "automatico" | "desconhecido";
  seats: number | null;
  bags: number | null;
  total_price: number | null;
  currency: CurrencyCode;
  deposit: number | null;
  insurance: string;
  deductible: string;
  fuel_policy: string;
  mileage: string;
  cancellation: string;
  extra_driver: string;
  license_requirements: string;
  booking_url: string;
  queried_at: ISODateTime;
}

export type ActivityCategory =
  | "atracao"
  | "parque"
  | "barco"
  | "museu"
  | "trilha"
  | "guia"
  | "familia"
  | "restaurante"
  | "bar"
  | "cafe"
  | "culinaria"
  | "religioso"
  | "mirante"
  | "outro";

export interface Activity extends Timestamps {
  id: ID;
  trip_id: ID;
  name: string;
  category: ActivityCategory;
  description: string;
  price_per_person: number | null;
  price_group: number | null;
  currency: CurrencyCode;
  duration_min: number | null;
  min_age: number | null;
  accessibility: string;
  meeting_point: string;
  cancellation_policy: string;
  provider_name: string;
  url: string;
  lat: number | null;
  lng: number | null;
  opening_hours: string;
  free_entry: boolean | null; // true = sem ingresso (transporte/taxas não incluídos)
  instagrammable: boolean;
  source: QuoteSource | "osm";
  source_ref: string; // ex.: "osm:node/123"
}

// ---------- Roteiro ----------

export interface ItineraryDay extends Timestamps {
  id: ID;
  trip_id: ID;
  date: ISODate;
  title: string;
  notes: string;
}

export type ItineraryItemKind = "passeio" | "refeicao" | "deslocamento" | "hospedagem" | "voo" | "descanso" | "outro";
export type ItineraryBookingStatus = "sugestao" | "planejado" | "reservado" | "concluido";

export interface ItineraryItem extends Timestamps {
  id: ID;
  trip_id: ID;
  day_id: ID;
  title: string;
  kind: ItineraryItemKind;
  start_time: string | null; // "HH:MM"
  duration_min: number;
  address: string;
  lat: number | null;
  lng: number | null;
  cost_estimate: number;
  currency: CurrencyCode;
  travel_min_from_prev: number | null;
  opening_hours: string; // ex.: "09:00-18:00"
  notes: string;
  booking_status: ItineraryBookingStatus;
  reservation_id: ID | null; // "reservado" exige reserva confirmada
  activity_id: ID | null;
  position: number;
}

// ---------- Orçamento ----------

export interface Budget extends Timestamps {
  id: ID;
  trip_id: ID;
  total: number;
  currency: CurrencyCode;
  alert_thresholds: number[]; // percentuais, ex.: [70, 90, 100]
  days_considered: number | null; // null = dias da viagem
  per_traveler_basis: "projecao" | "realizado" | "previsto";
}

export type BudgetCategoryKey =
  | "passagens"
  | "bagagem_aeroporto"
  | "hospedagem"
  | "carro"
  | "transporte"
  | "passeios"
  | "alimentacao"
  | "seguro"
  | "documentacao"
  | "compras"
  | "internet"
  | "emergencias"
  | string; // categorias personalizadas

export interface BudgetCategory extends Timestamps {
  id: ID;
  trip_id: ID;
  key: BudgetCategoryKey;
  name: string;
  color: string;
  is_custom: boolean;
  position: number;
}

export type ExpenseStatus = "previsto" | "cotado" | "reservado" | "parcial" | "pago" | "cancelado";
export type SplitMode = "todos" | "selecionados" | "personalizado" | "individual";

export interface Expense extends Timestamps {
  id: ID;
  trip_id: ID;
  category_key: BudgetCategoryKey;
  description: string;
  supplier: string;
  quantity: number;
  unit_price: number; // moeda original
  original_currency: CurrencyCode;
  fx_rate: number; // 1 unidade da moeda original = fx_rate na moeda base
  fees: number; // taxas adicionais, moeda original
  planned_amount: number; // previsto, moeda base
  quoted_amount: number; // cotado, moeda base (0 = sem cotação)
  reserved_amount: number; // compromisso reservado, moeda base (0 = sem reserva)
  due_date: ISODate | null;
  responsible_traveler_id: ID | null;
  status: ExpenseStatus; // apenas "cancelado" e "pago" (quitado) são definidos à mão
  receipt_document_id: ID | null;
  notes: string;
  split_mode: SplitMode;
  split: Record<ID, number>; // traveler_id -> peso (personalizado) ou 1 (selecionados/individual)
  quote_id: ID | null;
  reservation_id: ID | null;
  diary_entry_id: ID | null;
  incurred_on: ISODate | null;
}

export interface Payment extends Timestamps {
  id: ID;
  trip_id: ID;
  expense_id: ID;
  kind: "pagamento" | "estorno";
  amount: number; // moeda original, sempre positivo
  currency: CurrencyCode;
  fx_rate: number;
  paid_at: ISODate;
  payer_traveler_id: ID | null;
  method: "pix" | "cartao" | "dinheiro" | "transferencia" | "boleto" | "outro"; // nunca dados do cartão
  notes: string;
  receipt_document_id: ID | null;
}

// ---------- Reservas e documentos ----------

export type ReservationStatus = "pendente" | "confirmada" | "cancelada" | "concluida";

export interface Reservation extends Timestamps {
  id: ID;
  trip_id: ID;
  type: QuoteType;
  title: string;
  provider_name: string;
  confirmation_code: string;
  start_at: ISODateTime | null;
  end_at: ISODateTime | null;
  cancellation_policy: string;
  cancel_deadline: ISODateTime | null;
  amount: number;
  currency: CurrencyCode;
  status: ReservationStatus;
  url: string;
  expense_id: ID | null;
  notes: string;
}

export type DocumentKind = "voucher" | "comprovante" | "bilhete" | "seguro" | "documento" | "outro";

export interface TripDocument extends Timestamps {
  id: ID;
  trip_id: ID;
  reservation_id: ID | null;
  expense_id: ID | null;
  kind: DocumentKind;
  title: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
}

// ---------- Diário, mídia, álbuns e vídeo ----------

export interface StoryAnswer {
  question: string;
  answer: string;
}

export interface DiaryEntry extends Timestamps {
  id: ID;
  trip_id: ID;
  date: ISODate;
  title: string;
  body: string;
  location_name: string;
  lat: number | null;
  lng: number | null;
  author_traveler_id: ID | null;
  rating: number | null; // 1..5 avaliação pessoal da experiência
  mood: string;
  tags: string[];
  people: string[];
  instagrammable: boolean;
  story_answers: StoryAnswer[];
  is_draft: boolean;
  base_updated_at: ISODateTime | null; // versão do servidor em que o rascunho offline se baseou
}

export type MediaKind = "image" | "video" | "audio";

export interface MediaAsset extends Timestamps {
  id: ID;
  trip_id: ID;
  kind: MediaKind;
  storage_path: string;
  thumb_path: string | null;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_sec: number | null;
  taken_at: ISODateTime | null;
  lat: number | null;
  lng: number | null;
  caption: string;
  tags: string[];
  people: string[];
  album: string; // álbum/evento livre ("Glaciar", "Jantar")
  favorite: boolean;
  instagrammable: boolean;
  diary_entry_id: ID | null;
  story_answers: StoryAnswer[];
}

export interface PhotoEdit extends Timestamps {
  id: ID;
  trip_id: ID;
  media_id: ID;
  name: string;
  operations: Record<string, unknown>; // estado do editor (reaplicável sobre o original)
  output_path: string;
  output_mime: string;
  width: number;
  height: number;
}

export type AlbumFormat = "A4" | "quadrado" | "vertical" | "horizontal";

export interface Album extends Timestamps {
  id: ID;
  trip_id: ID;
  title: string;
  subtitle: string;
  format: AlbumFormat;
  margin_mm: number;
  gap_mm: number;
  background: string;
  frame: string;
  include_cover: boolean;
  include_toc: boolean;
  include_itinerary: boolean;
  include_budget: boolean;
  include_diary: boolean;
  footer_text: string;
  page_numbers: boolean;
}

export interface AlbumPageItem {
  media_id: ID;
  edit_id: ID | null;
  caption: string;
  frame: string;
  fit: "contain" | "cover";
}

export interface AlbumPage extends Timestamps {
  id: ID;
  album_id: ID;
  trip_id: ID;
  position: number;
  layout: "1" | "2" | "3" | "4" | "colagem" | "texto";
  title: string;
  text: string;
  date_label: string;
  background: string;
  frame: string;
  items: AlbumPageItem[];
  included: boolean;
}

export interface VideoClip {
  media_id: ID;
  start: number;
  end: number;
  volume: number; // 0..1
  muted: boolean;
  title: string;
  caption: string;
  date_label?: string;
  location_label?: string;
}

export interface VideoProject extends Timestamps {
  id: ID;
  trip_id: ID;
  title: string;
  aspect: "9:16" | "1:1" | "16:9";
  clips: VideoClip[];
  transition: "corte" | "fade";
  audio_media_id: ID | null; // áudio próprio ou licenciado
  audio_volume: number;
  resolution: 480 | 720 | 1080;
}

export interface AppNotification extends Timestamps {
  id: ID;
  trip_id: ID;
  user_id: ID | null;
  kind: "checkin" | "checkout" | "vencimento" | "horario" | "orcamento" | "convite" | "sistema";
  title: string;
  body: string;
  due_at: ISODateTime | null;
  read_at: ISODateTime | null;
  ref: string; // ex.: "reservation:<id>"
}

// Mapa tabela -> tipo de linha, usado pela camada de dados.
export interface TableMap {
  profiles: Profile;
  trips: Trip;
  trip_members: TripMember;
  destinations: Destination;
  travelers: Traveler;
  providers: Provider;
  search_queries: SearchQuery;
  quotes: Quote;
  activities: Activity;
  itinerary_days: ItineraryDay;
  itinerary_items: ItineraryItem;
  budgets: Budget;
  budget_categories: BudgetCategory;
  expenses: Expense;
  payments: Payment;
  reservations: Reservation;
  documents: TripDocument;
  diary_entries: DiaryEntry;
  media_assets: MediaAsset;
  photo_edits: PhotoEdit;
  albums: Album;
  album_pages: AlbumPage;
  video_projects: VideoProject;
  notifications: AppNotification;
}

export type TableName = keyof TableMap;
export type Row<T extends TableName> = TableMap[T];
export type NewRow<T extends TableName> = Omit<Row<T>, "id" | "created_at" | "updated_at"> & { id?: ID };
