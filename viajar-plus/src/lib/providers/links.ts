// Links de pesquisa externa com parâmetros pré-preenchidos. Não fazem scraping:
// apenas abrem o site do fornecedor, onde o usuário confere preço e disponibilidade.
// Alguns sites podem ignorar parte dos parâmetros.

export interface ExternalLink {
  label: string;
  url: string;
  note?: string;
}

const enc = encodeURIComponent;

export interface FlightLinkParams {
  origin: string;
  destination: string;
  departure_date: string;
  return_date?: string | null;
  adults: number;
  children_ages?: number[];
}

export function flightLinks(p: FlightLinkParams): ExternalLink[] {
  const o = p.origin.toUpperCase();
  const d = p.destination.toUpperCase();
  const ret = p.return_date ?? "";
  const yymmdd = (s: string) => s.slice(2).replace(/-/g, "");
  const ages = p.children_ages ?? [];
  const sky = `https://www.skyscanner.com.br/transporte/passagens-aereas/${o.toLowerCase()}/${d.toLowerCase()}/${yymmdd(p.departure_date)}/${ret ? `${yymmdd(ret)}/` : ""}?adultsv2=${p.adults}${ages.length ? `&childrenv2=${ages.join("%7C")}` : ""}`;
  const kayak = `https://www.kayak.com.br/flights/${o}-${d}/${p.departure_date}${ret ? `/${ret}` : ""}/${p.adults}adults${ages.length ? `/children-${ages.join("-")}` : ""}`;
  const gq = `Voos de ${o} para ${d} em ${p.departure_date}${ret ? ` volta ${ret}` : " somente ida"} ${p.adults} adultos${ages.length ? ` ${ages.length} crianças` : ""}`;
  return [
    { label: "Google Voos", url: `https://www.google.com/travel/flights?hl=pt-BR&q=${enc(gq)}` },
    { label: "Skyscanner", url: sky },
    { label: "Kayak", url: kayak },
    {
      label: "Decolar",
      url: `https://www.decolar.com/shop/flights/results/${ret ? "roundtrip" : "oneway"}/${o}/${d}/${p.departure_date}${ret ? `/${ret}` : ""}/${p.adults}/${ages.length}/0`,
    },
  ];
}

export interface LodgingLinkParams {
  destination: string;
  check_in: string;
  check_out: string;
  adults: number;
  children_ages?: number[];
  rooms?: number;
}

export function lodgingLinks(p: LodgingLinkParams): ExternalLink[] {
  const ages = p.children_ages ?? [];
  const booking = new URLSearchParams({
    ss: p.destination,
    checkin: p.check_in,
    checkout: p.check_out,
    group_adults: String(p.adults),
    group_children: String(ages.length),
    no_rooms: String(p.rooms ?? 1),
    lang: "pt-br",
  });
  ages.forEach((a) => booking.append("age", String(a)));
  const air = new URLSearchParams({ checkin: p.check_in, checkout: p.check_out, adults: String(p.adults), children: String(ages.length) });
  return [
    { label: "Booking.com", url: `https://www.booking.com/searchresults.pt-br.html?${booking}` },
    {
      label: "Airbnb",
      url: `https://www.airbnb.com.br/s/${enc(p.destination.replace(/\s+/g, "-"))}/homes?${air}`,
      note: "Somente link: o VIAJAR+ não acessa dados do Airbnb.",
    },
    { label: "Google Hotéis", url: `https://www.google.com/travel/search?hl=pt-BR&q=${enc(`hospedagem em ${p.destination} ${p.check_in} a ${p.check_out}`)}` },
    { label: "Decolar Hotéis", url: `https://www.decolar.com/hoteis/?q=${enc(p.destination)}` },
  ];
}

export interface CarLinkParams {
  pickup_place: string;
  pickup_date: string;
  pickup_time?: string;
  dropoff_date: string;
  dropoff_time?: string;
}

export function carLinks(p: CarLinkParams): ExternalLink[] {
  const h = (t?: string) => `${(t ?? "10:00").slice(0, 2)}h`;
  return [
    {
      label: "Kayak Carros",
      url: `https://www.kayak.com.br/cars/${enc(p.pickup_place.replace(/\s+/g, "-"))}/${p.pickup_date}-${h(p.pickup_time)}/${p.dropoff_date}-${h(p.dropoff_time)}`,
    },
    { label: "Rentalcars.com", url: "https://www.rentalcars.com/pt/", note: "Preencha local e datas no site." },
    { label: "Google", url: `https://www.google.com/search?q=${enc(`aluguel de carro ${p.pickup_place} ${p.pickup_date} a ${p.dropoff_date}`)}` },
  ];
}

export function activityLinks(destination: string, date?: string | null): ExternalLink[] {
  const gyg = new URLSearchParams({ q: destination });
  if (date) {
    gyg.set("date_from", date);
    gyg.set("date_to", date);
  }
  return [
    { label: "GetYourGuide", url: `https://www.getyourguide.com.br/s/?${gyg}` },
    { label: "Viator", url: `https://www.viator.com/pt-BR/searchResults/all?text=${enc(destination)}` },
    { label: "Tripadvisor", url: `https://www.tripadvisor.com.br/Search?q=${enc(destination)}` },
  ];
}

export function mapLinks(lat: number, lng: number, osmId?: string): ExternalLink[] {
  const out: ExternalLink[] = [{ label: "Google Maps", url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` }];
  const m = osmId ? /^osm:(node|way|relation)\/(\d+)$/.exec(osmId) : null;
  if (m) out.push({ label: "OpenStreetMap", url: `https://www.openstreetmap.org/${m[1]}/${m[2]}` });
  else out.push({ label: "OpenStreetMap", url: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}` });
  return out;
}
