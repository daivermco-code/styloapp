import { z } from "zod";

export const resetDemoSchema = z.object({ confirm: z.literal(true) });
export type ResetDemoInput = z.infer<typeof resetDemoSchema>;

/** Marca leídos los mensajes que ya llegaron hasta esa hora (la del más nuevo que se vio). */
export const markInboxReadSchema = z.object({
  before: z.iso.datetime({ offset: true }),
});
export type MarkInboxReadInput = z.infer<typeof markInboxReadSchema>;
