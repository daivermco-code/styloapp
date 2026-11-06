import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { minutesBetween } from "@/shared/lib/dates";

// El celular que está entrando vive en una cookie del servidor entre /entrar y /entrar/codigo,
// para no ponerlo en la URL.
export const LOGIN_PHONE_COOKIE = "styloapp-entrar";
export const CODE_LIFETIME_MINUTES = 10;

export async function setLoginPhone(phone: string): Promise<void> {
  const store = await cookies();
  store.set(LOGIN_PHONE_COOKIE, phone, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 60,
  });
}

export async function getLoginPhone(): Promise<string | null> {
  const store = await cookies();
  return store.get(LOGIN_PHONE_COOKIE)?.value ?? null;
}

export async function clearLoginPhone(): Promise<void> {
  const store = await cookies();
  store.delete(LOGIN_PHONE_COOKIE);
}

export interface LoginCodeMessage {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  /** Más de 10 minutos: "Ese código ya venció" (Tech Spec §13). */
  expired: boolean;
}

/**
 * El último código de entrada que llegó a la bandeja de un celular. Llave de servicio: leer el
 * código antes de tener sesión es uno de sus tres usos (invariante 4).
 */
export async function latestLoginCode(
  phone: string,
  now: Date = new Date(),
): Promise<LoginCodeMessage | null> {
  const { data, error } = await createAdminClient()
    .from("demo_messages")
    .select("id, title, body, created_at")
    .eq("recipient_phone", phone)
    .eq("kind", "login_code")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    body: data.body,
    createdAt: data.created_at,
    expired: minutesBetween(data.created_at, now) > CODE_LIFETIME_MINUTES,
  };
}
