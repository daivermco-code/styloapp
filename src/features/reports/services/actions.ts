"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const visitSchema = z.uuid();

/**
 * Suma una visita a la página del negocio (US-058, T-14.1.1). La llama la página al abrirse, una
 * vez por pestaña del navegador. No guarda quién la abrió, y la base no cuenta al equipo del
 * negocio. No devuelve nada: si no se guarda, a quien mira la página no le cambia nada.
 */
export async function recordProfileVisit(businessId: string): Promise<void> {
  const parsed = visitSchema.safeParse(businessId);
  if (!parsed.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_profile_visit", {
    p_business: parsed.data,
  });
  if (error) console.error("[recordProfileVisit]", error.code);
}
