import { z } from "zod";
import { parseDay } from "@/features/agenda/lib/grid";
import { EXPENSE_CATEGORIES } from "./expense";

// Textos de US-044: cada obligatorio dice qué falta.
export const NAME_REQUIRED = "Escribe el nombre del gasto.";
export const NAME_LENGTH = "El nombre debe tener entre 2 y 60 caracteres.";
export const CATEGORY_REQUIRED = "Elige la categoría del gasto.";
export const DATE_REQUIRED = "Elige la fecha de pago.";
export const DATE_FUTURE = "La fecha de pago no puede ser después de hoy.";
export const AMOUNT_REQUIRED = "Escribe el valor del gasto.";
export const AMOUNT_POSITIVE = "El valor debe ser mayor que 0.";
const AMOUNT_TOO_HIGH = "El valor es muy alto.";

/**
 * El gasto para guardar. `today` es el día de hoy en Bogotá: la fecha de pago es de lo que ya se
 * pagó, así que no va después de hoy.
 */
export function saveExpenseSchema(today: string) {
  return z.object({
    /** Sin id, es un gasto nuevo. */
    expenseId: z.uuid().optional(),
    name: z
      .string()
      .trim()
      .min(1, NAME_REQUIRED)
      .min(2, NAME_LENGTH)
      .max(60, NAME_LENGTH),
    category: z.enum(EXPENSE_CATEGORIES, { error: CATEGORY_REQUIRED }),
    paidOn: z
      .string({ error: DATE_REQUIRED })
      .refine((day) => parseDay(day) !== null, DATE_REQUIRED)
      .refine((day) => day <= today, DATE_FUTURE),
    amount: z
      .number({ error: AMOUNT_REQUIRED })
      .int(AMOUNT_POSITIVE)
      .min(1, AMOUNT_POSITIVE)
      .max(999_999_999, AMOUNT_TOO_HIGH),
    paymentMethodId: z.uuid().optional(),
  });
}

export type SaveExpenseInput = z.input<ReturnType<typeof saveExpenseSchema>>;

export const deleteExpenseSchema = z.object({ expenseId: z.uuid() });
export type DeleteExpenseInput = z.input<typeof deleteExpenseSchema>;
