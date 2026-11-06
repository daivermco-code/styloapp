import { z } from "zod";
import { findRangeError } from "@/features/agenda/lib/hours";
import { normalizePhone } from "@/shared/lib/phone";
import {
  CANCEL_LIMIT_OPTIONS,
  MAX_ADVANCE_OPTIONS,
  MIN_NOTICE_OPTIONS,
  SLOT_INTERVAL_OPTIONS,
} from "../lib/functions";

// Textos de US-008.
export const BUSINESS_NAME_LENGTH =
  "El nombre debe tener entre 2 y 60 caracteres.";
export const ADDRESS_REQUIRED = "Escribe la dirección del negocio.";
export const WHATSAPP_INVALID = "Escribe un celular colombiano de 10 dígitos.";

export const businessProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, BUSINESS_NAME_LENGTH)
    .max(60, BUSINESS_NAME_LENGTH),
  address: z
    .string()
    .trim()
    .min(1, ADDRESS_REQUIRED)
    .max(120, "La dirección es muy larga."),
  neighborhood: z.string().trim().max(60, "El barrio es muy largo."),
  city: z
    .string()
    .trim()
    .min(2, "Escribe la ciudad.")
    .max(60, "La ciudad es muy larga."),
  // Vacío = sin WhatsApp. Si se escribe, se guarda como "+573001234567".
  whatsapp: z
    .string()
    .trim()
    .refine((value) => value === "" || normalizePhone(value) !== null, {
      message: WHATSAPP_INVALID,
    }),
});

export type BusinessProfileInput = z.input<typeof businessProfileSchema>;

function oneOf<T extends number | null>(options: readonly T[]) {
  return (value: T) => options.includes(value);
}

export const businessFunctionsSchema = z.object({
  cancelLimitMinutes: z.number().int().refine(oneOf(CANCEL_LIMIT_OPTIONS)),
  slotIntervalMinutes: z.union(
    SLOT_INTERVAL_OPTIONS.map((value) => z.literal(value)),
  ),
  onlineBooking: z.boolean(),
  showOwnerAgenda: z.boolean(),
  minNoticeMinutes: z.number().int().refine(oneOf(MIN_NOTICE_OPTIONS)),
  maxAdvanceDays: z
    .number()
    .int()
    .nullable()
    .refine(oneOf(MAX_ADVANCE_OPTIONS)),
});

export type BusinessFunctionsInput = z.input<typeof businessFunctionsSchema>;

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Elige una hora.");

const daySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    ranges: z.array(z.object({ starts: clock, ends: clock })).max(6),
  })
  .superRefine((day, context) => {
    const message = findRangeError(day.ranges);
    if (message) context.addIssue({ code: "custom", message });
  });

// "Guardar" guarda la semana entera (US-009): los siete días, cada uno con sus franjas.
export const weekHoursSchema = z.object({
  /** null = el horario del negocio; si no, el del profesional. */
  staffId: z.uuid().nullable(),
  days: z
    .array(daySchema)
    .length(7)
    .refine(
      (days) => new Set(days.map((day) => day.weekday)).size === 7,
      "Faltan días de la semana.",
    ),
});

export type WeekHoursInput = z.input<typeof weekHoursSchema>;

// Textos de US-039.
export const METHOD_NAME_LENGTH = "El nombre debe tener entre 2 y 30 letras.";

/** Crear (sin id) o cambiar un método de pago (US-039). Solo el dueño. */
export const paymentMethodSchema = z.object({
  id: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(2, METHOD_NAME_LENGTH)
    .max(30, METHOD_NAME_LENGTH),
  isActive: z.boolean(),
});

export type PaymentMethodInput = z.input<typeof paymentMethodSchema>;

export const paymentMethodIdSchema = z.object({ id: z.uuid() });

export type PaymentMethodIdInput = z.input<typeof paymentMethodIdSchema>;
