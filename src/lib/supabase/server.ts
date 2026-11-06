import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/shared/types/database";
import { AUTH_COOKIE_NAME } from "./cookie";

export function supabaseServerEnv() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Faltan SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local",
    );
  }
  return { url, anonKey };
}

/**
 * Cliente de Supabase con la sesión de quien hace la petición (respeta RLS).
 * Para saber quién es, siempre `auth.getUser()`, nunca `getSession()` (invariante 2).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseServerEnv();

  return createServerClient<Database>(url, anonKey, {
    cookieOptions: { name: AUTH_COOKIE_NAME },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Un Server Component no puede escribir cookies; el proxy refresca la sesión.
        }
      },
    },
  });
}
