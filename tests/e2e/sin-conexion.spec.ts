// Fase 11, sin conexión (T-11.2.1, T-11.3.1): la franja "Sin conexión" en los dos lados y, al guardar sin
// internet, el aviso claro con lo escrito todavía en pantalla, también en la entrada (celular, código y
// perfil; arreglo 6 de la revisión de las Fases 8 a 14). Al volver la conexión se guarda igual.
// El service worker y la página /sin-conexion se prueban contra el build (`pwa.spec.ts`).
import { expect, type Page, test } from "@playwright/test";
import { sql } from "../db/helpers";
import {
  readCodeFromInbox,
  requestCodeFor,
  signIn,
  typeCode,
  visit,
} from "./helpers";

const OWNER = "3005550101"; // Valentina Ríos, Barbería La Clásica
const STAFF = "3005550111"; // Camilo Rojas: otro celular, para no chocar con el límite de 1 s entre códigos
const NEW_PERSON = "3005550187"; // no está en la semilla: entra por primera vez y completa el perfil
const BANNER = /Sin conexión\. Lo que escribas se queda aquí/;
const NOT_SAVED = "No se guardó nada. Lo que escribiste sigue aquí";

/** El aviso de las demás pantallas, y no la página de error que reemplaza el formulario. */
async function expectOfflineNotice(page: Page): Promise<void> {
  await expect(page.getByText("Sin conexión", { exact: true })).toBeVisible();
  await expect(page.getByText(NOT_SAVED)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sin conexión", level: 1 }),
  ).toHaveCount(0);
  // Todos los avisos usan el mismo id y duran 3 s: si no se espera, el siguiente solo actualiza este.
  await expect(page.getByText(NOT_SAVED)).toBeHidden();
}

test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

test("la franja avisa sin conexión en el lado de los clientes", async ({
  page,
  context,
}) => {
  await visit(page, "/app");
  await expect(
    page.getByRole("status").filter({ hasText: BANNER }),
  ).toHaveCount(0);

  await context.setOffline(true);
  await expect(
    page.getByRole("status").filter({ hasText: BANNER }),
  ).toBeVisible();

  await context.setOffline(false);
  await expect(
    page.getByRole("status").filter({ hasText: BANNER }),
  ).toHaveCount(0);
});

test("sin conexión, guardar avisa y lo escrito no se pierde", async ({
  page,
  context,
}) => {
  await signIn(page, OWNER);
  await visit(page, "/pro/configurar/metodos-de-pago");
  await page.getByRole("button", { name: "Agregar método de pago" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo método de pago" });
  await dialog.getByLabel("Nombre").fill("Daviplata");

  await context.setOffline(true);
  await expect(
    page.getByRole("status").filter({ hasText: BANNER }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Sin conexión", { exact: true })).toBeVisible();
  await expect(
    page.getByText("No se guardó nada. Lo que escribiste sigue aquí"),
  ).toBeVisible();
  // La ventana sigue abierta con el nombre, y la pantalla no cambió.
  await expect(dialog.getByLabel("Nombre")).toHaveValue("Daviplata");
  await expect(page).toHaveURL(/\/pro\/configurar\/metodos-de-pago$/);

  // Vuelve el internet: la franja se va y el mismo botón guarda.
  await context.setOffline(false);
  await expect(
    page.getByRole("status").filter({ hasText: BANNER }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Agregaste Daviplata.")).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByRole("listitem")
      .filter({ hasText: "Daviplata" }),
  ).toBeVisible();
});

test("sin conexión, pedir el código avisa sin salir del formulario", async ({
  page,
  context,
}) => {
  await visit(page, "/entrar");
  await page.getByLabel("Celular").fill(OWNER);
  await context.setOffline(true);
  await expect(
    page.getByRole("status").filter({ hasText: BANNER }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expectOfflineNotice(page);
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByLabel("Celular")).toHaveValue(OWNER);

  // Vuelve el internet: el mismo botón pide el código.
  await context.setOffline(false);
  await expect(
    page.getByRole("status").filter({ hasText: BANNER }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page).toHaveURL(/\/entrar\/codigo$/);
});

// La bandeja se lee antes de quitar el internet: en desarrollo, el aviso de errores de Next que deja
// la falla de red queda encima del botón de la bandeja (abajo a la izquierda).
test("sin conexión, confirmar el código o pedir otro avisa y las casillas lo guardan", async ({
  page,
  context,
}) => {
  await visit(page, "/entrar");
  await requestCodeFor(page, STAFF);
  const code = await readCodeFromInbox(page);
  await typeCode(page, code);

  // Sin internet, Enviar y Pedir uno nuevo avisan y las casillas guardan el código.
  await context.setOffline(true);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expectOfflineNotice(page);
  await expect(page).toHaveURL(/\/entrar\/codigo$/);
  await expect(
    page.getByRole("textbox", { name: "Número 1 del código" }),
  ).toHaveValue(code[0]);
  await expect(
    page.getByRole("textbox", { name: "Número 6 del código" }),
  ).toHaveValue(code[5]);

  await page.getByRole("button", { name: /Pedir uno nuevo/ }).click();
  await expectOfflineNotice(page);
  await expect(
    page.getByRole("button", { name: /Pedir uno nuevo/ }),
  ).toBeEnabled();
  await expect(
    page.getByRole("textbox", { name: "Número 6 del código" }),
  ).toHaveValue(code[5]);

  // Vuelve el internet: el mismo código entra.
  await context.setOffline(false);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page).toHaveURL(/\/pro$/);
});

test("sin conexión, completar el perfil avisa y lo escrito no se pierde", async ({
  page,
  context,
}) => {
  await visit(page, "/entrar");
  await requestCodeFor(page, NEW_PERSON);
  const code = await readCodeFromInbox(page);
  await typeCode(page, code);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page).toHaveURL(/\/entrar\/perfil/);

  await page.getByLabel("Nombre y apellido").fill("Sofía Navarro");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Guardar y seguir" }).click();
  await expectOfflineNotice(page);
  await expect(page).toHaveURL(/\/entrar\/perfil/);
  await expect(page.getByLabel("Nombre y apellido")).toHaveValue(
    "Sofía Navarro",
  );

  // Vuelve el internet: el mismo botón guarda y sale de la entrada.
  await context.setOffline(false);
  await page.getByRole("button", { name: "Guardar y seguir" }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
});
