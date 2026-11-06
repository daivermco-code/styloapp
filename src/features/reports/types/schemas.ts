import { z } from "zod";
import { daysInRange } from "../lib/range";

// Los filtros de Informes que llegan en la URL y la hoja "Filtrar: Rango" (Tech Spec O5.3 y
// O5.4, UI Pantalla 21). La base vuelve a revisar el rango (INVALID_RANGE).

/** Hasta un año: 366 días, los dos extremos incluidos (como report_guard). */
export const MAX_RANGE_DAYS = 366;

export const MISSING_FROM = "Elige la fecha Desde.";
export const MISSING_TO = "Elige la fecha Hasta.";
export const TO_BEFORE_FROM = "Hasta no puede ser antes de Desde.";
export const RANGE_TOO_LONG = "El rango puede ser de hasta un año.";

/** Desde y Hasta, días "YYYY-MM-DD" que existen. */
export const reportRangeSchema = z
  .object({
    from: z.iso.date(MISSING_FROM),
    to: z.iso.date(MISSING_TO),
  })
  .refine((range) => range.to >= range.from, {
    message: TO_BEFORE_FROM,
    path: ["to"],
  })
  .refine((range) => daysInRange(range) <= MAX_RANGE_DAYS, {
    message: RANGE_TOO_LONG,
    path: ["to"],
  });
export type ReportRangeInput = z.input<typeof reportRangeSchema>;

/** El profesional de ?pro=: solo un id con forma de uuid. */
export const reportStaffSchema = z.uuid();
