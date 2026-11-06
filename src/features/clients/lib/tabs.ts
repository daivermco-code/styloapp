import { plainText } from "@/features/explore/lib/search";

// Las pestañas de Clientes (US-047, pantalla 14). La base da los números de cada ficha
// (client_stats) y aquí se filtran y se ordenan, en el servidor, antes de pintar la lista.

export const CLIENT_TABS = [
  "todos",
  "mejores",
  "no-vuelven",
  "sin-visitas",
] as const;
export type ClientTab = (typeof CLIENT_TABS)[number];

/** Los próximos cumpleaños son los de los próximos 30 días (hoy cuenta). */
export const BIRTHDAY_WINDOW = 30;

/** Lo más largo que se busca (lo demás se corta). */
export const QUERY_MAX = 80;

/** Con cuántos dígitos la búsqueda también mira el celular. */
const PHONE_DIGITS = 3;

/** Una ficha con sus números, como la devuelve `client_stats`. */
export interface ClientStat {
  id: string;
  fullName: string;
  /** "+573005550201", o null si no tiene o no lo comparte. */
  phone: string | null;
  /** "YYYY-MM-DD", o null. */
  birthDate: string | null;
  /** Citas efectivas. */
  visits: number;
  /** Días desde la última cita efectiva, o null si no tiene ninguna. */
  daysAway: number | null;
  invoiced: number;
  hasAccount: boolean;
  isBlocked: boolean;
}

export interface ClientFilter {
  tab: ClientTab;
  query: string;
  /** Solo en Todos: los que cumplen años en los próximos 30 días. */
  birthdays: boolean;
}

/** La pestaña de `?pestana=`; lo que no se conoce es Todos. */
export function parseClientTab(value: unknown): ClientTab {
  return CLIENT_TABS.find((tab) => tab === value) ?? "todos";
}

function dayNumber(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** El cumpleaños en ese año: el 29 de febrero cae el 28 cuando el año no es bisiesto. */
function birthdayIn(year: number, month: number, day: number): number {
  const date = month === 2 && day === 29 && !isLeap(year) ? 28 : day;
  return dayNumber(year, month, date);
}

/** Días que faltan para el próximo cumpleaños (0 si es hoy), pasando por fin de año. */
export function daysToBirthday(birthDate: string, today: string): number {
  const [, month, day] = birthDate.split("-").map(Number);
  const [year, todayMonth, todayDay] = today.split("-").map(Number);
  const now = dayNumber(year, todayMonth, todayDay);
  const thisYear = birthdayIn(year, month, day);
  return (thisYear >= now ? thisYear : birthdayIn(year + 1, month, day)) - now;
}

/** Si la ficha coincide con la búsqueda: el nombre sin tildes o, con 3 dígitos o más, el celular. */
export function matchesClient(client: ClientStat, query: string): boolean {
  const wanted = plainText(query);
  if (!wanted) return true;
  if (plainText(client.fullName).includes(wanted)) return true;
  const digits = query.replace(/\D/g, "");
  return (
    digits.length >= PHONE_DIGITS &&
    !!client.phone &&
    client.phone.replace(/\D/g, "").includes(digits)
  );
}

function byName(a: ClientStat, b: ClientStat): number {
  return a.fullName.localeCompare(b.fullName, "es");
}

/** La lista de una pestaña, ya filtrada por la búsqueda y en su orden. */
export function clientsForTab(
  clients: ClientStat[],
  filter: ClientFilter,
  today: string,
): ClientStat[] {
  const found = clients.filter((client) => matchesClient(client, filter.query));
  switch (filter.tab) {
    case "mejores":
      return found
        .filter((client) => client.visits > 0)
        .sort((a, b) => b.visits - a.visits || byName(a, b));
    case "no-vuelven":
      return ranked(found, (client) => client.daysAway, "desc");
    case "sin-visitas":
      return found.filter((client) => client.visits === 0).sort(byName);
    case "todos":
      if (!filter.birthdays) return found.sort(byName);
      return ranked(found, (client) => upcomingBirthday(client, today), "asc");
  }
}

/** Los días para su cumpleaños si cae en los próximos 30, o null. */
export function upcomingBirthday(
  client: ClientStat,
  today: string,
): number | null {
  if (client.birthDate === null) return null;
  const days = daysToBirthday(client.birthDate, today);
  return days <= BIRTHDAY_WINDOW ? days : null;
}

/** Las fichas que tienen ese número, ordenadas por él (y por nombre si empatan). */
function ranked(
  clients: ClientStat[],
  value: (client: ClientStat) => number | null,
  order: "asc" | "desc",
): ClientStat[] {
  const sign = order === "asc" ? 1 : -1;
  return clients
    .flatMap((client) => {
      const number = value(client);
      return number === null ? [] : [{ client, number }];
    })
    .sort((a, b) => sign * (a.number - b.number) || byName(a.client, b.client))
    .map((item) => item.client);
}

/** La dirección de Clientes con su pestaña, el filtro de cumpleaños y la búsqueda. */
export function clientsHref(filter: ClientFilter): string {
  const params = new URLSearchParams();
  if (filter.tab !== "todos") params.set("pestana", filter.tab);
  if (filter.tab === "todos" && filter.birthdays) params.set("cumple", "1");
  const query = filter.query.trim();
  if (query) params.set("q", query);
  const search = params.toString();
  return search ? `/pro/clientes?${search}` : "/pro/clientes";
}

const SHORT_MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sept",
  "oct",
  "nov",
  "dic",
];

/** "1990-03-14" → "14 mar" (el año no cuenta). */
export function birthdayText(birthDate: string): string {
  const [, month, day] = birthDate.split("-").map(Number);
  return `${day} ${SHORT_MONTHS[month - 1]}`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** El dato de la fila en cada pestaña ("12 visitas", "45 días", "Cumple el 5 nov"), o null. */
export function tabDetail(
  client: ClientStat,
  filter: Pick<ClientFilter, "tab" | "birthdays">,
  today: string,
): string | null {
  switch (filter.tab) {
    case "mejores":
      return plural(client.visits, "visita", "visitas");
    case "no-vuelven":
      return client.daysAway === null
        ? null
        : plural(client.daysAway, "día", "días");
    case "sin-visitas":
      return "Sin visitas";
    case "todos":
      if (!filter.birthdays || client.birthDate === null) return null;
      return daysToBirthday(client.birthDate, today) === 0
        ? "Cumple hoy"
        : `Cumple el ${birthdayText(client.birthDate)}`;
  }
}
