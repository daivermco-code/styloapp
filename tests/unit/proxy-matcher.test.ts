// Revisión de las Fases 8 a 14, punto 7: el proxy revisa la sesión (una consulta a Supabase) solo en las
// pantallas. El service worker, el manifiesto y la página Sin conexión quedan fuera; lo protegido sigue dentro.
import { AsyncLocalStorage } from "node:async_hooks";
import { beforeAll, describe, expect, it } from "vitest";
import { config } from "@/proxy";

type DoesMatch = (options: { config: typeof config; url: string }) => boolean;
let runsProxy: (url: string) => boolean;

beforeAll(async () => {
  // Las utilidades de prueba de Next piden AsyncLocalStorage global, como en el servidor de Next.
  Object.assign(globalThis, { AsyncLocalStorage });
  const testing =
    (await import("next/experimental/testing/server")) as unknown as {
      unstable_doesMiddlewareMatch: DoesMatch;
    };
  runsProxy = (url) => testing.unstable_doesMiddlewareMatch({ config, url });
});

describe("matcher del proxy", () => {
  it.each([
    "/sw.js",
    "/sw.js?v=abc123",
    "/manifest.webmanifest",
    "/sin-conexion",
    "/sin-conexion.html",
    "/icon.svg",
    "/apple-icon.png",
    "/brand/logo.png",
  ])("no corre en %s", (url) => {
    expect(runsProxy(url)).toBe(false);
  });

  it.each([
    "/",
    "/entrar",
    "/app",
    "/app/reservas",
    "/app/perfil",
    "/app/sin-sesion",
    "/pro",
    "/pro/agenda",
    "/pro/configurar",
    "/pro/configurar/cuenta",
    "/pro/vincularme",
    "/n/barberia-la-clasica",
  ])("sigue corriendo en %s", (url) => {
    expect(runsProxy(url)).toBe(true);
  });
});
