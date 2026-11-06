import "server-only";
import type { User } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Solo rutas internas ("/pro/agenda"), nunca otro sitio ("//otro.com"). */
export function safeNext(next: string | undefined | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  if (next.startsWith("/\\") || next.startsWith("/entrar")) return null;
  return next;
}

/**
 * A dónde va una persona después de entrar (US-003): a completar el perfil si no tiene nombre;
 * si no, a la página que estaba pidiendo, o a su lado: dueño y profesional a /pro, profesional
 * sin negocio a /pro/vincularme, cliente a /app.
 */
export async function destinationAfterLogin(
  supabase: ServerClient,
  user: User,
  next?: string | null,
): Promise<string> {
  const target = safeNext(next);
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.full_name) {
    return target
      ? `/entrar/perfil?siguiente=${encodeURIComponent(target)}`
      : "/entrar/perfil";
  }
  if (target) return target;

  const { data: member } = await supabase
    .from("staff")
    .select("id")
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (member) return "/pro";
  if (user.app_metadata.demo_side === "staff") return "/pro/vincularme";
  return "/app";
}
