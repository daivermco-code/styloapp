import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/types/database";

/**
 * Cliente con la llave de servicio: se salta RLS. Solo en el servidor y solo para tres cosas
 * (invariante 4): listar las personas de la demo, leer el código de entrada de un celular
 * (últimos 10 minutos) y reiniciar la demo.
 */
export function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
