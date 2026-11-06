import { z } from "zod";
import { normalizePhone } from "@/shared/lib/phone";

// Textos de US-003.
export const PHONE_MESSAGE = "Escribe un celular colombiano de 10 dígitos.";

export const requestCodeSchema = z.object({
  phone: z
    .string()
    .transform((value) => normalizePhone(value))
    .refine((value): value is string => value !== null, PHONE_MESSAGE),
});
export type RequestCodeInput = z.input<typeof requestCodeSchema>;

export const verifyCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Escribe los 6 números del código."),
  next: z.string().optional(),
});
export type VerifyCodeInput = z.input<typeof verifyCodeSchema>;

export const GENDERS = ["male", "female", "other"] as const;

export const completeProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Escribe tu nombre.")
    .max(80, "El nombre es muy largo."),
  gender: z.enum(GENDERS).optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Revisa la fecha.")
    .optional(),
  next: z.string().optional(),
});
export type CompleteProfileInput = z.input<typeof completeProfileSchema>;
