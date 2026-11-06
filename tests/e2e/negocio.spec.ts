// Fase 2, "Configurar negocio" (US-008 a US-010): lo que el dueño cambia se guarda y se ve al
// recargar; el profesional no entra.
import { expect, test } from "@playwright/test";
import { sql } from "../db/helpers";
import { pickTime, signIn, visit } from "./helpers";

const OWNER = "3005550101"; // Valentina Ríos, Barbería La Clásica
const STAFF = "3005550111"; // Camilo Rojas, del mismo negocio

// Cada proyecto (navegador y tamaño) empieza con la demo como nueva.
test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

test("perfil del negocio: valida y guarda", async ({ page }) => {
  await signIn(page, OWNER);
  await visit(page, "/pro/configurar");
  await page.getByRole("link", { name: /Perfil del negocio/ }).click();
  await expect(page).toHaveURL(/\/pro\/configurar\/negocio$/);
  const save = page.getByRole("button", { name: "Guardar" });
  await expect(save).toBeEnabled();

  await page.getByLabel("Nombre del negocio").fill("B");
  await save.click();
  await expect(
    page.getByText("El nombre debe tener entre 2 y 60 caracteres."),
  ).toBeVisible();

  await page.getByLabel("Nombre del negocio").fill("Barbería La Clásica 57");
  await page.getByLabel("WhatsApp").fill("12345");
  await save.click();
  await expect(
    page.getByText("Escribe un celular colombiano de 10 dígitos."),
  ).toBeVisible();
  // Lo escrito sigue ahí.
  await expect(page.getByLabel("Nombre del negocio")).toHaveValue(
    "Barbería La Clásica 57",
  );

  await page.getByLabel("WhatsApp").fill("300 555 0199");
  await save.click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Nombre del negocio")).toHaveValue(
    "Barbería La Clásica 57",
  );
  await expect(page.getByLabel("WhatsApp")).toHaveValue("3005550199");
});

test("horario del negocio: franjas, cruces y día cerrado", async ({ page }) => {
  await signIn(page, OWNER);
  await visit(page, "/pro/configurar/horario");
  const save = page.getByRole("button", { name: "Guardar" });
  await expect(save).toBeDisabled();

  const monday = page.getByRole("group", { name: "Lunes" });
  await monday.getByRole("button", { name: "Agregar franja" }).click();
  await pickTime(page, "Lunes, franja 2: desde", "6:00 p. m.");
  await expect(
    monday.getByText("Estas franjas se cruzan. Ajusta una."),
  ).toBeVisible();
  await expect(save).toBeDisabled();

  // Almuerzo de 1:00 a 2:00 p. m.
  await pickTime(page, "Lunes, franja 1: hasta", "1:00 p. m.");
  await pickTime(page, "Lunes, franja 2: desde", "2:00 p. m.");
  await pickTime(page, "Lunes, franja 2: hasta", "7:00 p. m.");
  await expect(monday.getByRole("alert")).toHaveCount(0);

  const sunday = page.getByRole("group", { name: "Domingo" });
  await expect(sunday.getByText("Cerrado")).toBeVisible();
  await sunday.getByRole("switch", { name: "Domingo: abierto" }).click();
  await expect(sunday.getByText("Abierto")).toBeVisible();

  await save.click();
  await expect(page.getByText("Horario guardado")).toBeVisible();
  await expect(save).toBeDisabled();

  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Lunes, franja 1: hasta" }),
  ).toHaveText("1:00 p. m.");
  await expect(
    page.getByRole("combobox", { name: "Lunes, franja 2: hasta" }),
  ).toHaveText("7:00 p. m.");
  await expect(
    page.getByRole("switch", { name: "Domingo: abierto" }),
  ).toBeChecked();
});

test("funciones adicionales: se guardan y se ven en el menú", async ({
  page,
}) => {
  await signIn(page, OWNER);
  await visit(page, "/pro/configurar/funciones");
  const save = page.getByRole("button", { name: "Guardar" });
  await expect(save).toBeDisabled();

  await page.getByRole("combobox", { name: "Cancelación de citas" }).click();
  await page.getByRole("option", { name: "1 h antes" }).click();
  await page.getByRole("switch", { name: "Reservas en línea" }).click();
  await expect(
    page.getByText(
      "Este negocio no está recibiendo reservas en línea por ahora.",
      { exact: false },
    ),
  ).toBeVisible();
  await save.click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();
  // Con lo guardado ya de vuelta, el formulario queda sin cambios.
  await expect(save).toBeDisabled();

  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL(/\/pro\/configurar$/);
  await expect(
    page.getByRole("link", { name: /Cancelación de citas.*1 h antes/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Reservas en línea.*Apagadas/ }),
  ).toBeVisible();
});

test("el profesional no entra a Configurar negocio", async ({ page }) => {
  await signIn(page, STAFF);
  for (const path of [
    "/pro/configurar",
    "/pro/configurar/horario",
    "/pro/configurar/negocio",
    "/pro/servicios",
    "/pro/servicios/nuevo",
  ]) {
    await visit(page, path);
    await expect(page).toHaveURL(/\/pro$/);
  }
});
