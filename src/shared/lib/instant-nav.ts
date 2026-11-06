// Reglas de la respuesta inmediata (Fase 17, T-17.1.1): qué control se ve elegido mientras llega la
// pantalla pedida. Puras, sin React, para probarlas solas.

/**
 * Los grupos de controles de cada pantalla. Viven aquí (no en un archivo de cliente) para que las
 * páginas del servidor también los usen en su PendingArea.
 */
export const NAV_GROUP = {
  agenda: "agenda",
  agendaBooking: "agenda-cita",
  period: "periodo",
  periodShift: "periodo-flechas",
  staff: "profesional",
  invoiceFilters: "filtros-facturas",
  invoiceOrder: "orden-facturas",
  reportTabs: "pestanas-informes",
  reportRange: "rango-informes",
  clients: "clientes",
  clientBirthdays: "clientes-cumple",
  clientSearch: "clientes-busqueda",
  tabs: "pestanas",
  staffSwitcher: "equipo",
  payroll: "liquidador",
} as const;

/** Lo pedido al tocar un control: la dirección y el grupo de controles que la pidió. */
export interface PendingRequest {
  href: string;
  group: string;
}

function split(href: string): { path: string; params: URLSearchParams } {
  const [beforeHash] = href.split("#");
  const [path, query = ""] = beforeHash.split("?");
  return { path, params: new URLSearchParams(query) };
}

/** El valor de un parámetro en una dirección ("/pro/agenda?dia=2026-11-06&vista=lista"). */
export function paramOf(href: string, name: string): string | null {
  return split(href).params.get(name);
}

/** Dos direcciones son la misma aunque los parámetros vengan en otro orden. */
export function sameHref(a: string, b: string): boolean {
  const left = split(a);
  const right = split(b);
  if (left.path !== right.path) return false;
  left.params.sort();
  right.params.sort();
  return left.params.toString() === right.params.toString();
}

/**
 * Si el control está elegido. Mientras su grupo espera la pantalla, el elegido es el que se tocó
 * (aunque el servidor no haya respondido); si espera otro grupo o nada, el que dice el servidor.
 */
export function isSelected(
  selected: boolean,
  href: string,
  group: string,
  pending: PendingRequest | null,
): boolean {
  if (!pending || pending.group !== group) return selected;
  return sameHref(pending.href, href);
}
