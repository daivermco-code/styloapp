// Fase 11, la app instalable (T-11.1.1, T-11.1.2, T-11.3.1). El service worker solo se registra en
// producción, así que estas pruebas corren contra el build y se saltan contra el servidor de desarrollo:
//   npm run build && npm run start -- -p 3100
//   E2E_PWA=1 E2E_BASE_URL=http://localhost:3100 npx playwright test tests/e2e/pwa.spec.ts --project=chromium-celular
import { expect, type Page, test } from "@playwright/test";
import { sql } from "../db/helpers";
import { signIn, visit } from "./helpers";

const OWNER = "3005550101"; // Valentina Ríos, Barbería La Clásica

test.skip(
  process.env.E2E_PWA !== "1",
  "Solo contra el build (E2E_PWA=1 y E2E_BASE_URL del npm start).",
);

test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

/** Espera a que el service worker controle la página. */
async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const controlled = await page.evaluate(
    () => navigator.serviceWorker.controller !== null,
  );
  if (!controlled) await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null),
    )
    .toBe(true);
}

/** Las direcciones de todo lo que quedó en las cachés de la app. */
async function cachedPaths(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const paths: string[] = [];
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      for (const request of await cache.keys()) {
        const url = new URL(request.url);
        paths.push(
          `${url.origin === location.origin ? "" : url.origin}${url.pathname}${url.search}`,
        );
      }
    }
    return paths;
  });
}

test("el manifiesto, los íconos y el ícono del iPhone", async ({
  page,
  request,
}) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({
    name: "StyloApp",
    start_url: "/",
    display: "standalone",
    theme_color: "#0E7C74",
    background_color: "#0E7C74",
  });
  for (const icon of manifest.icons as { src: string }[]) {
    const response = await request.get(icon.src);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );

  await visit(page, "/");
  const apple = page.locator('link[rel="apple-touch-icon"]');
  await expect(apple).toHaveAttribute("sizes", "180x180");
  const appleIcon = await request.get((await apple.getAttribute("href")) ?? "");
  expect(appleIcon.ok()).toBe(true);

  // El iPhone abre con la marca: sin la meta de Apple ignora las imágenes de arranque y abre en negro.
  await expect(
    page.locator('meta[name="apple-mobile-web-app-capable"]'),
  ).toHaveAttribute("content", "yes");
  const startup = page.locator('link[rel="apple-touch-startup-image"]');
  await expect(startup).toHaveCount(17);
  for (const href of await startup.evaluateAll((links) =>
    links.map((link) => link.getAttribute("href") ?? ""),
  )) {
    // Sin sesión (el contexto de `request` no tiene cookies).
    const response = await request.get(href);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toBe("image/png");
  }

  const worker = await request.get("/sw.js");
  expect(worker.headers()["cache-control"]).toContain("no-cache");
  expect(worker.headers()["content-type"]).toContain("javascript");
});

test("sin internet, una pantalla abre la página Sin conexión con Reintentar", async ({
  page,
  context,
}) => {
  await visit(page, "/app");
  await waitForServiceWorker(page);

  await context.setOffline(true);
  await page.goto("/app/ofertas");
  await expect(
    page.getByRole("heading", { name: "Sin conexión", level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/app\/ofertas$/);

  // Reintentar sin internet vuelve a mostrarla.
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(
    page.getByRole("heading", { name: "Sin conexión", level: 1 }),
  ).toBeVisible();

  // Vuelve el internet: la página se recarga sola y abre la pantalla que se pidió.
  await context.setOffline(false);
  await expect(page.getByRole("heading", { name: "Sin conexión" })).toHaveCount(
    0,
  );
  await expect(page).toHaveURL(/\/app\/ofertas$/);
  await expect(page.getByRole("main")).toBeVisible();
});

test("la caché solo guarda lo que no cambia, nunca páginas con datos", async ({
  page,
}) => {
  await signIn(page, OWNER);
  await waitForServiceWorker(page);
  for (const path of [
    "/pro/agenda",
    "/pro/facturas",
    "/pro/clientes",
    "/app/reservas",
  ]) {
    await visit(page, path);
    await page.waitForLoadState("networkidle");
  }

  const paths = await cachedPaths(page);
  expect(paths).toContain("/sin-conexion");
  expect(paths.some((path) => path.startsWith("/_next/static/"))).toBe(true);
  const allowed = (path: string) =>
    path === "/sin-conexion" ||
    path.startsWith("/_next/static/") ||
    path.startsWith("/brand/") ||
    ["/icon.svg", "/favicon.ico"].includes(path) ||
    path.startsWith("/apple-icon.png");
  expect(paths.filter((path) => !allowed(path))).toEqual([]);
});
