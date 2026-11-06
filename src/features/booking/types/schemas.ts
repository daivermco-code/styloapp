import { z } from "zod";
import { MISSING_DATA } from "@/features/agenda/types/schemas";
import { completeProfileSchema } from "@/features/auth/types/schemas";
import { PREFERENCE_KEYS } from "./profile";

// Textos de US-027 (reservar como cliente).
export const CLIENT_SLOT_TAKEN = "Esa hora se acaba de ocupar. Elige otra.";
export const CLIENT_NO_HOURS = "No quedan horas este día. Prueba otro.";
export const CLIENT_BLOCKED_MESSAGE =
  "No puedes reservar en línea en este negocio. Escríbeles para saber más.";
export const OUT_OF_HOURS_MESSAGE =
  "Esa hora ya no se puede reservar. Elige otra.";
export const SERVICE_GONE = "Este servicio ya no se puede reservar.";

// Textos de US-029 (modificar y cancelar como cliente).
export const CLIENT_TOO_LATE =
  "Ya no puedes cambiarla desde la app. Escríbele al negocio.";
export const BOOKING_GONE = "Esta cita ya no se puede cambiar.";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, MISSING_DATA);

/** Las horas libres para el cliente: la duración la pone el servidor, no el navegador. */
export const clientHoursSchema = z.object({
  businessId: z.uuid(MISSING_DATA),
  serviceId: z.uuid(MISSING_DATA),
  staffId: z.uuid(MISSING_DATA),
  day,
});
export type ClientHoursInput = z.input<typeof clientHoursSchema>;

/** Reservar como cliente (US-027). Ni el fin ni el precio vienen del navegador. */
export const bookAsClientSchema = z.object({
  serviceId: z.uuid(MISSING_DATA),
  staffId: z.uuid(MISSING_DATA),
  day,
  time: z.string().regex(/^\d{2}:\d{2}$/, MISSING_DATA),
  whatsappPromos: z.boolean(),
});
export type BookAsClientInput = z.input<typeof bookAsClientSchema>;

/** Las horas para cambiar una cita propia: su hora cuenta como libre. */
export const rescheduleHoursSchema = z.object({
  bookingId: z.uuid(MISSING_DATA),
  day,
});
export type RescheduleHoursInput = z.input<typeof rescheduleHoursSchema>;

/** Cambiar la hora de una cita propia (US-029): mismo servicio y profesional. */
export const rescheduleAsClientSchema = rescheduleHoursSchema.extend({
  time: z.string().regex(/^\d{2}:\d{2}$/, MISSING_DATA),
});
export type RescheduleAsClientInput = z.input<typeof rescheduleAsClientSchema>;

export const cancelAsClientSchema = z.object({
  bookingId: z.uuid(MISSING_DATA),
});
export type CancelAsClientInput = z.input<typeof cancelAsClientSchema>;

// Textos de US-032 (perfil del cliente).
export const NAME_MESSAGE = "Escribe tu nombre (entre 2 y 80 caracteres).";

/** Editar el perfil: el mismo esquema de la entrada (`features/auth`) con el texto de US-032. */
export const editProfileSchema = completeProfileSchema
  .omit({ next: true })
  .extend({
    fullName: z.string().trim().min(2, NAME_MESSAGE).max(80, NAME_MESSAGE),
  });
export type EditProfileInput = z.input<typeof editProfileSchema>;

/** Un interruptor del perfil, que se guarda al tocarlo. */
export const preferenceSchema = z.object({
  key: z.enum(PREFERENCE_KEYS),
  value: z.boolean(),
});
export type PreferenceInput = z.input<typeof preferenceSchema>;
