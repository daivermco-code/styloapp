import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/shared/types/database";
import { AUTH_COOKIE_NAME } from "./cookie";

/**
 * Cliente de Supabase para el navegador. En la nube (Vercel) la dirección llega en
 * NEXT_PUBLIC_SUPABASE_URL. En local, un celular de la casa no llega a 127.0.0.1: la URL se arma
 * con el host desde el que se abrió la app y el puerto de Supabase.
 */
export function createClient() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  }
  const port = process.env.NEXT_PUBLIC_SUPABASE_PORT ?? "54321";
  const { protocol, hostname } = window.location;
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? `${protocol}//${hostname}:${port}`;

  return createBrowserClient<Database>(url, anonKey, {
    cookieOptions: { name: AUTH_COOKIE_NAME },
  });
}
