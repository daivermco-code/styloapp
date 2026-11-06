import { z } from "zod";
import { parseDay } from "@/features/agenda/lib/grid";

// "Pagar" del liquidador (T-9.2.2, US-045). El valor no viaja: pay_staff lo suma en la base.
export const METHOD_REQUIRED = "Elige el método de pago.";
export const PAY_DATE_REQUIRED = "Elige la fecha del pago.";
export const PAY_DATE_FUTURE = "La fecha del pago no puede ser después de hoy.";
export const NOTE_LENGTH = "La nota va hasta 200 caracteres.";

/** `today` es el día de hoy en Bogotá, como lo revisa pay_staff. */
export function payStaffSchema(today: string) {
  return z.object({
    staffId: z.uuid(),
    paymentMethodId: z.uuid(METHOD_REQUIRED),
    paidOn: z
      .string({ error: PAY_DATE_REQUIRED })
      .refine((day) => parseDay(day) !== null, PAY_DATE_REQUIRED)
      .refine((day) => day <= today, PAY_DATE_FUTURE),
    note: z.string().trim().max(200, NOTE_LENGTH).optional(),
  });
}

export type PayStaffInput = z.input<ReturnType<typeof payStaffSchema>>;
