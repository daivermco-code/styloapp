import { formatMinutes } from "@/shared/lib/duration";

// Opciones de las funciones adicionales (US-010) y cómo se dicen. Las usan el menú de
// "Configurar negocio" (el valor a la derecha de cada fila) y el formulario.

export const CANCEL_LIMIT_OPTIONS = [0, 15, 30, 60, 120, 180, 360, 720, 1440];
export const SLOT_INTERVAL_OPTIONS = [15, 30, 60] as const;
export const MIN_NOTICE_OPTIONS = [0, 15, 30, 60, 120, 180, 360, 720, 1440];
/** null = sin límite ("Siempre" en pantalla). */
export const MAX_ADVANCE_OPTIONS = [null, 1, 3, 7, 15, 30, 60, 90];

export type SlotInterval = (typeof SLOT_INTERVAL_OPTIONS)[number];

export interface BusinessFunctions {
  cancelLimitMinutes: number;
  slotIntervalMinutes: SlotInterval;
  onlineBooking: boolean;
  showOwnerAgenda: boolean;
  minNoticeMinutes: number;
  maxAdvanceDays: number | null;
}

/** Solo las funciones, sin el resto de datos del negocio (para el formulario). */
export function pickFunctions(source: BusinessFunctions): BusinessFunctions {
  return {
    cancelLimitMinutes: source.cancelLimitMinutes,
    slotIntervalMinutes: source.slotIntervalMinutes,
    onlineBooking: source.onlineBooking,
    showOwnerAgenda: source.showOwnerAgenda,
    minNoticeMinutes: source.minNoticeMinutes,
    maxAdvanceDays: source.maxAdvanceDays,
  };
}

export function cancelLimitLabel(minutes: number): string {
  return minutes === 0 ? "Hasta la hora" : `${formatMinutes(minutes)} antes`;
}

export function slotIntervalLabel(minutes: number): string {
  return `Cada ${minutes} min`;
}

export function minNoticeLabel(minutes: number): string {
  return minutes === 0 ? "Sin mínimo" : formatMinutes(minutes);
}

export function maxAdvanceLabel(days: number | null): string {
  if (days === null) return "Sin límite";
  return days === 1 ? "1 día" : `${days} días`;
}

export const ONLINE_BOOKING_OFF =
  "Este negocio no está recibiendo reservas en línea por ahora.";
