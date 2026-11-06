import { z } from "zod";
import { parseDay } from "@/features/agenda/lib/grid";
import { GENDERS } from "@/features/auth/types/schemas";
import { normalizePhone } from "@/shared/lib/phone";

// Textos de US-048: el editor de cliente.
export const NAME_REQUIRED = "Escribe el nombre del cliente.";
export const NAME_LENGTH = "El nombre debe tener entre 2 y 80 caracteres.";
export const PHONE_INVALID =
  "Escribe un celular de 10 dígitos que empiece por 3.";
export const BIRTH_INVALID = "Revisa la fecha de nacimiento.";
export const BIRTH_FUTURE =
  "La fecha de nacimiento no puede ser después de hoy.";
export const NOTES_LENGTH = "Las notas van hasta 500 caracteres.";

/** La primera fecha que deja el calendario. */
export const FIRST_BIRTH_DATE = "1900-01-01";

/**
 * La ficha para guardar. `today` es el día de hoy en Bogotá: nadie nace después de hoy.
 *
 * `phone` sin mandar deja el celular como está (la ficha de alguien con cuenta que no lo comparte
 * llega sin él y no se debe borrar); vacío lo quita, y 10 dígitos lo ponen.
 */
export function saveClientSchema(today: string) {
  return z.object({
    /** Sin id, es un cliente nuevo. */
    clientId: z.uuid().optional(),
    fullName: z
      .string()
      .trim()
      .min(1, NAME_REQUIRED)
      .min(2, NAME_LENGTH)
      .max(80, NAME_LENGTH),
    birthDate: z
      .string()
      .refine(
        (day) => parseDay(day) !== null && day >= FIRST_BIRTH_DATE,
        BIRTH_INVALID,
      )
      .refine((day) => day <= today, BIRTH_FUTURE)
      .nullable(),
    gender: z.enum(GENDERS).nullable(),
    phone: z
      .string()
      .transform((value, context) => {
        if (value.trim() === "") return null;
        const phone = normalizePhone(value);
        if (!phone) {
          context.addIssue({ code: "custom", message: PHONE_INVALID });
          return z.NEVER;
        }
        return phone;
      })
      .optional(),
    notes: z
      .string()
      .trim()
      .max(500, NOTES_LENGTH)
      .transform((value) => value || null),
    whatsappOk: z.boolean(),
    promosOk: z.boolean(),
  });
}

export type SaveClientInput = z.input<ReturnType<typeof saveClientSchema>>;
