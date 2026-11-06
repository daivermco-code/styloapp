import { z } from "zod";
import { normalizePhone } from "@/shared/lib/phone";

// Textos de US-017 y US-018.
export const MISSING_DATA = "Faltan datos por completar";
export const SLOT_TAKEN_MESSAGE =
  "Alguien acaba de tomar esa hora. Elige otra.";
export const NO_FREE_HOURS = "No quedan horas libres este día.";
export const GUEST_NAME = "Escribe el nombre del cliente.";
export const CLIENT_NAME = "El nombre debe tener entre 2 y 80 caracteres.";
export const CLIENT_PHONE = "Escribe un celular colombiano de 10 dígitos.";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, MISSING_DATA);
const duration = z
  .number()
  .int()
  .min(5, "La duración va de 5 minutos a 10 horas.")
  .max(600, "La duración va de 5 minutos a 10 horas.");

export const freeHoursSchema = z.object({
  staffId: z.uuid(MISSING_DATA),
  day,
  durationMinutes: duration,
  /** La cita que se está modificando: su hora cuenta como libre. */
  exceptId: z.uuid().nullable(),
});
export type FreeHoursInput = z.input<typeof freeHoursSchema>;

const bookingFields = {
  staffId: z.uuid(MISSING_DATA),
  serviceId: z.uuid(MISSING_DATA),
  day,
  time: z.string().regex(/^\d{2}:\d{2}$/, MISSING_DATA),
  durationMinutes: duration,
  /** Sin ficha de cliente, el nombre de quien viene (Seguir sin cliente). */
  guestName: z.string().trim().max(80, CLIENT_NAME).nullable(),
};

export const createBookingSchema = z
  .object({ ...bookingFields, clientId: z.uuid().nullable() })
  .refine((value) => value.clientId || (value.guestName ?? "").length >= 2, {
    message: GUEST_NAME,
    path: ["guestName"],
  });
export type CreateBookingInput = z.input<typeof createBookingSchema>;

export const updateBookingSchema = z.object({
  ...bookingFields,
  bookingId: z.uuid(),
});
export type UpdateBookingInput = z.input<typeof updateBookingSchema>;

export const quickClientSchema = z.object({
  fullName: z.string().trim().min(2, CLIENT_NAME).max(80, CLIENT_NAME),
  /** Opcional: vacío queda sin celular. */
  phone: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const phone = normalizePhone(value);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: CLIENT_PHONE });
        return z.NEVER;
      }
      return phone;
    }),
});
export type QuickClientInput = z.input<typeof quickClientSchema>;

export const NOTE_LENGTH = "La nota puede tener hasta 500 caracteres.";

export const bookingIdSchema = z.object({ bookingId: z.uuid() });
export type BookingIdInput = z.input<typeof bookingIdSchema>;

/** Cancelar una cita; si es de una serie, solo esa o esa y las siguientes (US-022). */
export const cancelBookingSchema = z.object({
  bookingId: z.uuid(),
  scope: z.enum(["one", "following"]).default("one"),
});
export type CancelBookingInput = z.input<typeof cancelBookingSchema>;

export const bookingNoteSchema = z.object({
  bookingId: z.uuid(),
  note: z.string().trim().max(500, NOTE_LENGTH),
});
export type BookingNoteInput = z.input<typeof bookingNoteSchema>;

// Fase 4: clientes bloqueados (US-020), bloqueos (US-021) y series (US-022).
export const clientBlockSchema = z.object({
  clientId: z.uuid(),
  blocked: z.boolean(),
});
export type ClientBlockInput = z.input<typeof clientBlockSchema>;

export const BLOCK_RANGE = "El bloqueo debe terminar después de empezar.";
/** Los bloqueos van en cuadritos de 15 minutos ("24:00" es el fin del día). */
const quarterClock = z.string().regex(/^\d{2}:(00|15|30|45)$/, MISSING_DATA);

export const createBlockSchema = z
  .object({
    staffId: z.uuid(MISSING_DATA),
    day,
    starts: quarterClock,
    ends: quarterClock,
  })
  .refine((value) => value.ends > value.starts, {
    message: BLOCK_RANGE,
    path: ["ends"],
  });
export type CreateBlockInput = z.input<typeof createBlockSchema>;

export const blockIdSchema = z.object({ blockId: z.uuid() });
export type BlockIdInput = z.input<typeof blockIdSchema>;

export const SERIES_COUNT = "El número de citas va de 1 a 52.";

export const seriesPreviewSchema = z.object({
  staffId: z.uuid(MISSING_DATA),
  day,
  time: bookingFields.time,
  durationMinutes: duration,
  frequency: z.enum(["weekly", "biweekly", "monthly"]),
  count: z.number().int().min(1, SERIES_COUNT).max(52, SERIES_COUNT),
});
export type SeriesPreviewInput = z.input<typeof seriesPreviewSchema>;

/** La serie siempre va con una ficha de cliente (recurring_bookings.client_id). */
export const createSeriesSchema = seriesPreviewSchema.extend({
  serviceId: z.uuid(MISSING_DATA),
  clientId: z.uuid(MISSING_DATA),
});
export type CreateSeriesInput = z.input<typeof createSeriesSchema>;

/** "Eliminar serie" en Agendas recurrentes (US-050). */
export const deleteSeriesSchema = z.object({ recurringId: z.uuid() });
export type DeleteSeriesInput = z.input<typeof deleteSeriesSchema>;
