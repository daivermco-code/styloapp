// Fase 6, mapa y ofertas (US-025), sin sesión. Los cuadros de OpenStreetMap se bloquean: así la
// prueba no depende de internet y comprueba que sin ellos quedan los marcadores y el aviso.
import { expect, test } from "@playwright/test";
import { sql } from "../db/helpers";
import { visit } from "./helpers";

const MAP_OFFLINE = "El mapa necesita internet para dibujarse.";

test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

test("sin internet el mapa deja los marcadores y el aviso; tocar uno muestra su tarjeta", async ({
  page,
}) => {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await visit(page, "/app/mapa");
  await expect(page.getByText(MAP_OFFLINE)).toBeVisible();

  const card = page.getByRole("region", { name: "Negocio elegido" });
  // Arranca con el más cercano al punto de la demo.
  await expect(card).toContainText("Barbería La Clásica");
  await page.getByRole("button", { name: "Spa Raíces" }).click();
  await expect(card).toContainText("Spa Raíces");
  await card.getByRole("link", { name: "Ver negocio" }).click();
  await expect(page).toHaveURL(/\/app\/negocio\//);
  await expect(
    page.getByRole("heading", { name: "Spa Raíces", level: 2 }),
  ).toBeVisible();

  // "Ver en el mapa" vuelve al mapa con ese negocio elegido.
  await page.getByRole("link", { name: "Ver en el mapa" }).click();
  await expect(page).toHaveURL(/\/app\/mapa\?negocio=/);
  await expect(card).toContainText("Spa Raíces");
});

test("ofertas ordena, filtra por tipo y abre el negocio; sin vencidas ni inactivas", async ({
  page,
}) => {
  await visit(page, "/app/ofertas");
  const offers = page
    .getByRole("list", { name: "Ofertas" })
    .getByRole("listitem");
  // La semilla trae 16: 3 inactivas y 3 vencidas no salen.
  await expect(offers).toHaveCount(10);
  await expect(offers.first()).toContainText("$ 24.000");

  await page.getByRole("button", { name: "Descuento" }).click();
  await expect(offers.first()).toContainText("−20 %");

  await page.getByRole("button", { name: "Combo" }).click();
  await expect(offers).toHaveCount(5);
  for (const item of await offers.all()) {
    await expect(item).toContainText("Combo");
  }

  await offers.first().click();
  await expect(page).toHaveURL(/\/app\/negocio\//);
});
