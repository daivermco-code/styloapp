import { z } from "zod";
import { DURATION_RANGE, REQUIRED } from "@/features/catalog/types/schemas";

// Textos de US-012.
export const LINK_CODE_FORMAT = "El código tiene 6 letras.";
export const DISPLAY_NAME_LENGTH =
  "Tu nombre debe tener entre 2 y 40 caracteres.";

export const linkStaffSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, REQUIRED)
    .regex(/^[A-Z]{6}$/, LINK_CODE_FORMAT),
  displayName: z
    .string()
    .trim()
    .min(1, REQUIRED)
    .min(2, DISPLAY_NAME_LENGTH)
    .max(40, DISPLAY_NAME_LENGTH),
});

export type LinkStaffInput = z.input<typeof linkStaffSchema>;

export const staffIdSchema = z.object({ staffId: z.uuid() });

export type StaffIdInput = z.input<typeof staffIdSchema>;

/** Los servicios que hace un profesional y su duración con él (US-013 y US-014). */
export const staffServicesSchema = z.object({
  staffId: z.uuid(),
  services: z
    .array(
      z.object({
        serviceId: z.uuid(),
        /** null = la duración del servicio. */
        durationMinutes: z
          .number()
          .int(DURATION_RANGE)
          .min(5, DURATION_RANGE)
          .max(600, DURATION_RANGE)
          .nullable(),
      }),
    )
    .max(300),
});

export type StaffServicesInput = z.input<typeof staffServicesSchema>;

// Textos de US-037.
export const PRICE_RANGE = "Escribe el precio en pesos, sin decimales.";
export const COMMISSION_RANGE =
  "La comisión va de 0 a 100 %, con hasta dos decimales.";

/** La comisión vacía en la base vale 50 % (Tech Spec O4.1). */
export const DEFAULT_COMMISSION = 50;

/** Precio y comisión de cada servicio de un profesional (US-037). Solo el dueño. */
export const staffPricingSchema = z.object({
  staffId: z.uuid(),
  rows: z
    .array(
      z.object({
        serviceId: z.uuid(),
        /** null = el precio general del servicio. */
        price: z
          .number()
          .int(PRICE_RANGE)
          .min(0, PRICE_RANGE)
          .max(100_000_000, PRICE_RANGE)
          .nullable(),
        commissionPct: z
          .number()
          .min(0, COMMISSION_RANGE)
          .max(100, COMMISSION_RANGE)
          .refine(
            (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
            COMMISSION_RANGE,
          ),
      }),
    )
    .max(300),
});

export type StaffPricingInput = z.input<typeof staffPricingSchema>;

/** Los 5 interruptores de Permisos del equipo (US-038). Solo el dueño. */
export const teamPermissionsSchema = z.object({
  internalClients: z.boolean(),
  invoicing: z.boolean(),
  manualBooking: z.boolean(),
  manualBlock: z.boolean(),
  seeClientPhone: z.boolean(),
});

export type TeamPermissionsInput = z.input<typeof teamPermissionsSchema>;
