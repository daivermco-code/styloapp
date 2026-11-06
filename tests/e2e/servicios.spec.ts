// Fase 2, catálogo (US-011): crear un servicio con su categoría nueva, las validaciones del
// editor, archivar y volver a activar.
import { expect, type Page, test } from "@playwright/test";
import { sql } from "../db/helpers";
import { signIn, visit } from "./helpers";

const OWNER = "3005550101"; // Valentina Ríos, Barbería La Clásica

// Cada proyecto (navegador y tamaño) empieza con la demo como nueva.
test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(page.getByRole("combobox", { name: label })).toHaveText(option);
}

test("crear un servicio con categoría nueva, archivarlo y activarlo", async ({
  page,
}) => {
  await signIn(page, OWNER);
  await visit(page, "/pro/servicios/nuevo");
  const create = page.getByRole("button", { name: "Crear servicio" });
  await expect(create).toBeDisabled();
  await expect(
    page.getByText("Falta: Nombre, Categoría, Para quién, Precio."),
  ).toBeVisible();

  await page.getByLabel("Nombre").fill("Masaje capilar");
  await page.getByRole("button", { name: "Nueva" }).click();
  const dialog = page.getByRole("dialog", { name: "Nueva categoría" });
  await dialog.getByLabel("Nombre de la categoría").fill("Spa capilar");
  await dialog.getByRole("button", { name: "Crear categoría" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("combobox", { name: "Categoría" })).toHaveText(
    "Spa capilar",
  );
  await choose(page, "Para quién", "Unisex");

  const duration = page.getByLabel("Duración del servicio");
  await duration.fill("4");
  await duration.blur();
  await expect(
    page.getByText("La duración va de 5 minutos a 10 horas."),
  ).toBeVisible();
  await duration.fill("40");

  await choose(page, "Tipo de precio", "Rango");
  await page.getByLabel("Precio inicial").fill("30000");
  await expect(page.getByLabel("Precio inicial")).toHaveValue("30.000");
  await page.getByLabel("Precio final").fill("20000");
  await page.getByLabel("Precio final").blur();
  await expect(
    page.getByText("El precio final debe ser mayor que el inicial."),
  ).toBeVisible();
  await expect(create).toBeDisabled();
  await page.getByLabel("Precio final").fill("45000");

  await expect(create).toBeEnabled();
  await create.click();
  // Guardar y volver a la lista: en el servidor de desarrollo, WebKit puede tardar más.
  await expect(page).toHaveURL(/\/pro\/servicios$/, { timeout: 20_000 });
  const group = page.locator("details", { hasText: "Spa capilar" });
  await expect(group.getByText("Masaje capilar")).toBeVisible();
  await expect(group.getByText("$ 30.000 – $ 45.000")).toBeVisible();

  await page.getByRole("button", { name: "Archivar Masaje capilar" }).click();
  await expect(group).toBeHidden();
  await page.getByRole("link", { name: /Archivados \(1\)/ }).click();
  await expect(page).toHaveURL(/pestana=archivados/);
  await page.getByRole("button", { name: "Activar Masaje capilar" }).click();
  await expect(page.getByText("No tienes servicios archivados.")).toBeVisible();
  await page.getByRole("link", { name: /Activos/ }).click();
  await expect(
    page.getByRole("heading", { name: "Masaje capilar" }),
  ).toBeVisible();
});

test("editar un servicio y ver el cambio en la lista", async ({ page }) => {
  await signIn(page, OWNER);
  await visit(page, "/pro/servicios");
  await page.getByRole("link", { name: "Editar Corte clásico" }).click();
  await expect(page.getByLabel("Nombre")).toHaveValue("Corte clásico");

  await page.getByLabel("Nombre").fill("");
  await page.getByLabel("Nombre").blur();
  await expect(page.getByText("Este dato es obligatorio.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Guardar cambios" }),
  ).toBeDisabled();

  await page.getByLabel("Nombre").fill("Corte clásico con lavado");
  await page.getByRole("textbox", { name: "Precio", exact: true }).fill("28000");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(/\/pro\/servicios$/, { timeout: 20_000 });
  const card = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: "Corte clásico con lavado" }),
  });
  await expect(card.getByText("$ 28.000")).toBeVisible();
});
