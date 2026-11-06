import { z } from "zod";

/** La llegada del cliente (US-019): 5 a tiempo, 3 tarde, 1 no llegó. */
export const PUNCTUALITY = { onTime: 5, late: 3, noShow: 1 } as const;

export const punctualitySchema = z.object({
  bookingId: z.uuid(),
  punctuality: z.union([z.literal(5), z.literal(3), z.literal(1)]),
});
export type PunctualityInput = z.input<typeof punctualitySchema>;

// Textos de US-030 (calificar la cita). La segunda calificación se llama igual en todas partes.
export const ATTENTION_LABEL = "Atención y trato";
export const QUALITY_LABEL = "Resultado del servicio";
export const STARS_MISSING = "Pon las estrellas para poder enviar.";
export const ALREADY_REVIEWED = "Ya calificaste esta cita.";
export const NOT_REVIEWABLE = "Esta cita no se puede calificar.";
export const COMMENT_MAX = 500;

const stars = z.number().int().min(1, STARS_MISSING).max(5, STARS_MISSING);

/** Una reseña (US-030): el negocio, el profesional y el autor los pone la base. */
export const reviewSchema = z.object({
  bookingId: z.uuid(),
  attention: stars,
  quality: stars,
  comment: z
    .string()
    .trim()
    .max(COMMENT_MAX, `Máximo ${COMMENT_MAX} caracteres.`)
    .transform((text) => (text.length > 0 ? text : null)),
});
export type ReviewInput = z.input<typeof reviewSchema>;
