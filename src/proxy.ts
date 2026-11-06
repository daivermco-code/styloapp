import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/supabase/cookie";
import type { Database } from "@/shared/types/database";

// Protección de zonas (Tech Spec §6.3). Invariante 1: nadie entra a /pro sin sesión y sin una
// fila activa en staff; las partes personales de /app piden sesión. Invariante 2: la sesión se
// revisa con auth.getUser(), nunca con getSession().

const CLIENT_PERSONAL_PATHS = [
  "/app/reservas",
  "/app/calificar",
  "/app/reputacion",
  "/app/resenas",
  "/app/seguidos",
  "/app/perfil",
];
const OWNER_ONLY_PATHS = ["/pro/servicios", "/pro/configurar"];
// Dentro de /pro/configurar, la cuenta del profesional (su horario y sus servicios).
const STAFF_ACCOUNT_PATH = "/pro/configurar/cuenta";
const LINK_PATH = "/pro/vincularme";
// La pantalla "Mejora tu experiencia" con Entrar (se construye en la Fase 5).
const CLIENT_SIGN_IN_PROMPT = "/app/sin-sesion";

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export async function proxy(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Faltan SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local",
    );
  }

  let response = NextResponse.next({ request });
  let sessionHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(url, anonKey, {
    cookieOptions: { name: AUTH_COOKIE_NAME },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        sessionHeaders = headers;
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Refresca la sesión: nada entre createServerClient y getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // Una redirección o reescritura lleva las cookies de sesión recién refrescadas.
  const keepSession = (target: NextResponse) => {
    response.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
    Object.entries(sessionHeaders).forEach(([key, value]) =>
      target.headers.set(key, value),
    );
    return target;
  };
  const redirectTo = (path: string, next?: string) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = next ? `?siguiente=${encodeURIComponent(next)}` : "";
    return keepSession(NextResponse.redirect(target));
  };

  if (isUnder(pathname, "/pro")) {
    if (!user) return redirectTo("/entrar", pathname);

    const { data: member } = await supabase
      .from("staff")
      .select("role")
      .eq("profile_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (isUnder(pathname, LINK_PATH)) {
      return member ? redirectTo("/pro") : response;
    }
    if (!member) return redirectTo(LINK_PATH);

    const ownerOnly =
      OWNER_ONLY_PATHS.some((base) => isUnder(pathname, base)) &&
      !isUnder(pathname, STAFF_ACCOUNT_PATH);
    if (ownerOnly && member.role !== "owner") return redirectTo("/pro");

    return response;
  }

  if (!user && CLIENT_PERSONAL_PATHS.some((base) => isUnder(pathname, base))) {
    const target = request.nextUrl.clone();
    target.pathname = CLIENT_SIGN_IN_PROMPT;
    target.search = `?siguiente=${encodeURIComponent(pathname)}`;
    return keepSession(NextResponse.rewrite(target));
  }

  return response;
}

export const config = {
  matcher: [
    // Todo menos archivos estáticos, imágenes, los recursos de public/ y lo de la app instalable (el service
    // worker, el manifiesto y la página Sin conexión), que no necesitan revisar la sesión (revisión, punto 7).
    "/((?!_next/static|_next/image|favicon.ico|brand/|demo/|sw\\.js$|manifest\\.webmanifest$|sin-conexion(?:\\.html)?$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
