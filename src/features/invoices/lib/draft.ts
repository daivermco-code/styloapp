import type {
  BookingCategoryOption,
  BookingServiceOption,
} from "@/features/agenda/types/agenda";
import {
  INVOICE_PAID_OUT,
  INVOICE_VOIDED,
  NOT_OWN_INVOICE,
} from "../types/messages";
import type { ChangeTarget, ChangeViewer } from "./detail";

// Las cuentas del editor de factura (T-8.3.1 y T-8.3.2, US-040, US-041 y US-043, pantalla 8).
// Son puras para probarlas sin la base; la base vuelve a revisar todo en save_invoice.

/** Máximo de servicios por factura (save_invoice: ITEMS_COUNT). */
export const MAX_ITEMS = 20;
/** Comisión cuando el profesional no tiene una propia (staff_commission en la base). */
export const DEFAULT_COMMISSION = 50;

/** Un servicio marcado en el borrador, con su profesional y su valor (null: campo vacío). */
export interface DraftItem {
  serviceId: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  price: number | null;
}

/** El valor propuesto: el precio del servicio con ese profesional (el suyo o el general). */
export function proposedItem(
  service: BookingServiceOption,
  staffId?: string,
): DraftItem | null {
  const staff =
    service.staff.find((option) => option.id === staffId) ?? service.staff[0];
  if (!staff) return null;
  return {
    serviceId: service.id,
    serviceName: service.name,
    staffId: staff.id,
    staffName: staff.name,
    price: staff.price,
  };
}

/** La llave de la comisión de un profesional en un servicio. */
export function commissionKey(staffId: string, serviceId: string): string {
  return `${staffId}:${serviceId}`;
}

/**
 * La comisión en pesos, redondeada como la columna generada de invoice_items (round de numeric,
 * .5 hacia arriba). La cuenta va en enteros, con el porcentaje en centésimas: en coma flotante,
 * 5000 × 2,01 % daría 100 y la base guarda 101.
 */
export function commissionOf(price: number, pct: number): number {
  return Math.floor((price * Math.round(pct * 100) + 5000) / 10000);
}

/**
 * El total del borrador y la comisión del equipo. La comisión sale solo si se conoce el
 * porcentaje (el dueño lo lee con staff_commissions; al profesional la base no se lo deja leer).
 */
export function draftTotals(
  items: DraftItem[],
  commissions: Record<string, number> | null,
): { total: number; commission: number | null } {
  let total = 0;
  let commission = 0;
  for (const item of items) {
    const price = item.price ?? 0;
    total += price;
    const pct =
      commissions?.[commissionKey(item.staffId, item.serviceId)] ??
      DEFAULT_COMMISSION;
    commission += commissionOf(price, pct);
  }
  return { total, commission: commissions ? commission : null };
}

/** Un servicio que la factura o la cita ya traen, por si el catálogo de hoy ya no lo tiene. */
export interface SeedService {
  serviceId: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  price: number;
}

const SEED_CATEGORY = "En esta factura";

function seedStaff(seed: SeedService) {
  return {
    id: seed.staffId,
    name: seed.staffName,
    durationMinutes: 0,
    price: seed.price,
  };
}

/** El servicio con el profesional de la semilla, si no lo tenía. */
function addStaff(
  service: BookingServiceOption,
  seeds: SeedService[],
): BookingServiceOption {
  const extra = seeds.filter(
    (seed) =>
      seed.serviceId === service.id &&
      !service.staff.some((staff) => staff.id === seed.staffId),
  );
  if (extra.length === 0) return service;
  return { ...service, staff: [...service.staff, ...extra.map(seedStaff)] };
}

/**
 * El catálogo con lo que traen la factura o la cita aunque hoy no esté: un profesional que ya no
 * hace el servicio se suma a ese servicio, y un servicio archivado va en "En esta factura", para
 * poder verlo y quitarlo.
 */
export function withSeedServices(
  categories: BookingCategoryOption[],
  seeds: SeedService[],
): BookingCategoryOption[] {
  const known = new Set(
    categories.flatMap((category) => category.services.map((s) => s.id)),
  );
  const merged = categories.map((category) => ({
    ...category,
    services: category.services.map((service) => addStaff(service, seeds)),
  }));
  const missing = new Map<string, BookingServiceOption>();
  for (const seed of seeds) {
    if (known.has(seed.serviceId)) continue;
    const current = missing.get(seed.serviceId) ?? {
      id: seed.serviceId,
      name: seed.serviceName,
      priceLabel: "",
      durationMinutes: 0,
      staff: [],
    };
    missing.set(seed.serviceId, addStaff(current, [seed]));
  }
  if (missing.size === 0) return merged;
  return [
    ...merged,
    {
      id: "en-esta-factura",
      name: SEED_CATEGORY,
      services: [...missing.values()],
    },
  ];
}

/**
 * Por qué una factura no se puede editar (US-043), o null si se puede: anulada, ya pagada al
 * profesional, o, para el profesional, con servicios de otro (lo dice la base con
 * invoice_all_mine: la RLS le esconde los ajenos). El permiso se revisa antes, en la página.
 */
export function editBlockReason(
  viewer: ChangeViewer,
  target: ChangeTarget,
): string | null {
  if (target.status === "void") return INVOICE_VOIDED;
  if (target.paidOut) return INVOICE_PAID_OUT;
  if (viewer.side === "owner") return null;
  return target.allMine ? null : NOT_OWN_INVOICE;
}
