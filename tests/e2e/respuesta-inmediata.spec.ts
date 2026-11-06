// Fase 17, respuesta inmediata (T-17.3.1): los controles que cambian algo dentro de la misma pantalla
// se mueven al tocarlos y la parte que depende del servidor sale en esqueleto mientras llega. Para
// verlo, cada prueba demora a propósito la respuesta del servidor de esa pantalla (las peticiones
// RSC de Next): el control ya cambió y el esqueleto está antes de que llegue, y al final se ve la
// información nueva.
import { expect, type Locator, type Page, test } from "@playwright/test";
import { sql } from "../db/helpers";
import { signIn, visit } from "./helpers";

const OWNER = "3005550101"; // Valentina Ríos, Barbería La Clásica
const DELAY_MS = 2_500;

test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

/**
 * Demora la respuesta del servidor a la navegación dentro de esta ruta (Next la pide con la
 * cabecera RSC y el parámetro `_rsc`; WebKit no siempre deja ver la cabecera) y devuelve cómo
 * soltarla de una vez. La carga previa de los enlaces (solo en producción) no se demora.
 */
async function slowServer(page: Page, path: string): Promise<() => void> {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      const request = route.request();
      const headers = await request.allHeaders();
      const rsc =
        new URL(request.url()).searchParams.has("_rsc") ||
        Boolean(headers["rsc"]);
      const prefetch = Boolean(
        headers["next-router-prefetch"] ||
        headers["next-router-segment-prefetch"],
      );
      if (rsc && !prefetch) {
        await Promise.race([
          gate,
          new Promise((resolve) => setTimeout(resolve, DELAY_MS * 4)),
        ]);
      }
      await route.continue();
    },
  );
  return release;
}

test.describe("dueño", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, OWNER);
  });

  test("agenda: el interruptor de la lista y los días responden al tocarlos", async ({
    page,
  }) => {
    await visit(page, "/pro/agenda");
    const toggle = page.getByRole("switch", {
      name: "Cambiar a vista de lista",
    });
    await expect(toggle).not.toBeChecked();
    await expect(page.getByLabel("Cargando la agenda")).toHaveCount(0);

    const release = await slowServer(page, "/pro/agenda");
    await tap(toggle);
    // Antes de que responda el servidor: el interruptor ya cambió y la lista está en esqueleto.
    await expect(toggle).toBeChecked({ timeout: 1_000 });
    await expect(page.getByLabel("Cargando la agenda")).toBeVisible({
      timeout: 1_000,
    });
    release();
    await expect(page).toHaveURL(/vista=lista/);
    await expect(page.getByLabel("Cargando la agenda")).toHaveCount(0);
    await expect(toggle).toBeChecked();
  });

  test("agenda: la cita se abre de una en esqueleto y se cierra en el acto", async ({
    page,
  }) => {
    // La primera cita del día en la lista (la demo tiene citas hoy).
    await visit(page, "/pro/agenda?vista=lista");
    // La agenda se recarga sola al conectarse al tiempo real: se toca cuando ya pasó.
    await page.waitForLoadState("networkidle");
    const row = page.locator('a[href*="cita="]').first();
    const href = (await row.getAttribute("href")) ?? "";
    const id = new URLSearchParams(href.split("?")[1]).get("cita") ?? "";

    let release = await slowServer(page, "/pro/agenda");
    await tap(row);
    await expect(
      page.getByRole("status", { name: "Cargando la cita" }),
    ).toBeVisible({
      timeout: 1_000,
    });
    release();
    const dialog = page.getByRole("dialog");
    await expect(page).toHaveURL(new RegExp(`cita=${id}`));
    await expect(
      page.getByRole("status", { name: "Cargando la cita" }),
    ).toHaveCount(0);
    await expect(dialog).toBeVisible();

    // Cerrar no espera a la agenda.
    release = await slowServer(page, "/pro/agenda");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0, { timeout: 1_000 });
    release();
    await expect(page).not.toHaveURL(/cita=/);
  });

  test("facturas: el periodo y el profesional se marcan al tocarlos", async ({
    page,
  }) => {
    await visit(page, "/pro/facturas");
    const periods = page.getByRole("navigation", { name: "Periodo" });
    const week = periods.getByRole("link", { name: "Semana" });
    await expect(week).not.toHaveAttribute("aria-current", "page");

    let release = await slowServer(page, "/pro/facturas");
    await tap(week);
    await expectInstant(page, week, "Cargando las facturas");
    release();
    await expect(page).toHaveURL(/periodo=semana/);
    await expect(page.getByLabel("Cargando las facturas")).toHaveCount(0);

    const staff = page
      .getByRole("navigation", { name: "Profesional" })
      .getByRole("link")
      .nth(1);
    release = await slowServer(page, "/pro/facturas");
    await tap(staff);
    await expectInstant(page, staff, "Cargando las facturas");
    release();
    await expect(page).toHaveURL(/pro=/);
    await expect(page.getByLabel("Cargando las facturas")).toHaveCount(0);
  });

  test("informes: la pestaña se marca y su informe sale en esqueleto", async ({
    page,
  }) => {
    await visit(page, "/pro/informes");
    const sales = page.getByRole("link", { name: "Ventas", exact: true });
    const release = await slowServer(page, "/pro/informes");
    await tap(sales);
    await expectInstant(page, sales, "Cargando el informe");
    release();
    await expect(page).toHaveURL(/pestana=ventas/);
    await expect(page.getByLabel("Cargando el informe")).toHaveCount(0);
  });

  test("servicios: las pestañas Activos y Archivados responden al tocarlas", async ({
    page,
  }) => {
    await visit(page, "/pro/servicios");
    const archived = page.getByRole("link", { name: "Archivados" });
    const release = await slowServer(page, "/pro/servicios");
    await tap(archived);
    await expectInstant(page, archived, "Cargando");
    release();
    await expect(page).toHaveURL(/archivados/);
    await expect(page.getByRole("status", { name: "Cargando" })).toHaveCount(0);
  });

  test("clientes: la pestaña se marca y la lista sale en esqueleto", async ({
    page,
  }) => {
    await visit(page, "/pro/clientes");
    const best = page
      .getByRole("navigation", { name: "Pestañas de clientes" })
      .getByRole("link", { name: "Mejores clientes" });
    const release = await slowServer(page, "/pro/clientes");
    await tap(best);
    await expectInstant(page, best, "Cargando los clientes");
    release();
    await expect(page).toHaveURL(/mejores/);
    await expect(page.getByLabel("Cargando los clientes")).toHaveCount(0);
  });

  test("liquidador: la hoja del profesional se abre de una", async ({
    page,
  }) => {
    await visit(page, "/pro/liquidador");
    const release = await slowServer(page, "/pro/liquidador");
    await tap(page.locator('a[href*="/pro/liquidador?pro="]').first());
    await expect(page.getByRole("status", { name: "Cargando" })).toBeVisible({
      timeout: 1_000,
    });
    release();
    await expect(page).toHaveURL(/pro=/);
    await expect(page.getByRole("status", { name: "Cargando" })).toHaveCount(0);
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("configurar: pasar a una subpágina sale de una con su esqueleto", async ({
    page,
    browserName,
  }) => {
    // WebKit no deja ver la cabecera de la carga previa: la prueba la demoraría también.
    test.skip(
      browserName === "webkit",
      "WebKit esconde la cabecera de la carga previa",
    );
    // El esqueleto de la subpágina llega con la carga previa del enlace, que Next solo hace en
    // producción: esta corre contra el build (E2E_BASE_URL), como pwa.spec.ts.
    test.skip(
      !process.env.E2E_BASE_URL,
      "la carga previa es solo de producción",
    );
    await visit(page, "/pro/configurar");
    await page.waitForLoadState("networkidle");
    const schedule = page.getByRole("link", { name: /Horario del negocio/ });
    const release = await slowServer(page, "/pro/configurar/horario");
    await tap(schedule);
    await expect(page.getByRole("status", { name: "Cargando" })).toBeVisible({
      timeout: 1_000,
    });
    release();
    await expect(page).toHaveURL(/\/pro\/configurar\/horario/);
    await expect(page.getByRole("status", { name: "Cargando" })).toHaveCount(0);
  });
});

/**
 * Toca el control cuando React ya lo hidrató: antes, el enlace es uno común y el navegador carga la
 * página entera (WebKit tarda más en hidratar y la prueba toca de una).
 */
async function tap(control: Locator): Promise<void> {
  await expect
    .poll(() =>
      control.evaluate((element) =>
        Object.keys(element).some((key) => key.startsWith("__reactProps")),
      ),
    )
    .toBe(true);
  await control.click();
}

/**
 * Antes de que responda el servidor: el control tocado ya quedó elegido y la parte que depende de
 * él está en esqueleto.
 */
async function expectInstant(
  page: Page,
  control: Locator,
  skeleton: string,
): Promise<void> {
  await expect(control).toHaveAttribute("aria-current", "page", {
    timeout: 1_000,
  });
  await expect(page.getByLabel(skeleton).first()).toBeVisible({
    timeout: 1_000,
  });
}
