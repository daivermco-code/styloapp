import { z } from "zod";
import { AUDIENCES, PRICE_TYPES } from "./catalog";

// Textos de US-011.
export const REQUIRED = "Este dato es obligatorio.";
export const DURATION_RANGE = "La duración va de 5 minutos a 10 horas.";
export const PRICE_TO_LOWER = "El precio final debe ser mayor que el inicial.";
export const CATEGORY_NAME_LENGTH =
  "El nombre debe tener entre 2 y 40 caracteres.";
const SERVICE_NAME_LENGTH = "El nombre debe tener entre 2 y 60 caracteres.";

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, CATEGORY_NAME_LENGTH)
    .max(40, CATEGORY_NAME_LENGTH),
});

export type CategoryInput = z.input<typeof categorySchema>;

const pesos = z
  .number({ error: REQUIRED })
  .int("Escribe el precio sin decimales.")
  .min(0, "El precio no puede ser negativo.")
  .max(100_000_000, "El precio es muy alto.");

export const serviceSchema = z
  .object({
    /** Sin id, es un servicio nuevo. */
    id: z.uuid().optional(),
    name: z
      .string()
      .trim()
      .min(1, REQUIRED)
      .min(2, SERVICE_NAME_LENGTH)
      .max(60, SERVICE_NAME_LENGTH),
    categoryId: z.uuid(REQUIRED),
    audience: z.enum(AUDIENCES, { error: REQUIRED }),
    description: z
      .string()
      .trim()
      .max(300, "La descripción va hasta 300 caracteres."),
    durationMinutes: z
      .number({ error: REQUIRED })
      .int(DURATION_RANGE)
      .min(5, DURATION_RANGE)
      .max(600, DURATION_RANGE),
    priceType: z.enum(PRICE_TYPES),
    price: pesos,
    priceTo: pesos.nullable(),
  })
  .superRefine((service, context) => {
    if (service.priceType !== "range") return;
    if (service.priceTo === null) {
      context.addIssue({
        code: "custom",
        message: REQUIRED,
        path: ["priceTo"],
      });
    } else if (service.priceTo <= service.price) {
      context.addIssue({
        code: "custom",
        message: PRICE_TO_LOWER,
        path: ["priceTo"],
      });
    }
  });

export type ServiceInput = z.input<typeof serviceSchema>;

export const serviceStateSchema = z.object({
  id: z.uuid(),
  active: z.boolean(),
});
