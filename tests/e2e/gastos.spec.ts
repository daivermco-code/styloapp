// Fase 7, métodos de pago (US-039): crear, renombrar, desactivar y borrar, con los avisos del
// nombre repetido, del método en uso y del último activo. Fase 9, gastos (US-044, T-9.4.1): crear,
// editar y borrar un gasto, con las validaciones y el total del periodo; el profesional no los ve.
import { expect, type Page, test } from "@playwright/test";
import { sql } from "../db/helpers";
import { signIn, visit } from "./helpers";

const OWNER = "3005550101"; // Valentina Ríos, Barbería La Clásica
const STAFF = "3005550111"; // Camilo Rojas, del mismo negocio

// Cada proyecto (navegador y tamaño) empieza con la demo como nueva.
test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

test("la dueña crea, renombra, desactiva y borra métodos de pago", async ({
  page,
}) => {
  await signIn(page, OWNER);
  await visit(page, "/pro/configurar");
  await page.getByRole("link", { name: /^Métodos de pago/ }).click();
  await expect(page).toHaveURL(/\/pro\/configurar\/metodos-de-pago$/);
  const list = page.getByRole("main").getByRole("listitem");
  await expect(list).toHaveText(["Efectivo", "Banco"]);

  // Agregar: el nombre no se repite, sin importar mayúsculas.
  await page.getByRole("button", { name: "Agregar método de pago" }).click();
  let dialog = page.getByRole("dialog", { name: "Nuevo método de pago" });
  await dialog.getByLabel("Nombre").fill("efectivo");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(
    dialog.getByText("Ya tienes un método con ese nombre."),
  ).toBeVisible();
  await dialog.getByLabel("Nombre").fill("Nequi");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Agregaste Nequi.")).toBeVisible();
  await expect(list).toHaveText(["Efectivo", "Banco", "Nequi"]);

  // Renombrar.
  await page.getByRole("button", { name: "Editar Nequi" }).click();
  dialog = page.getByRole("dialog", { name: "Editar método de pago" });
  await expect(dialog.getByLabel("Nombre")).toHaveValue("Nequi");
  await dialog.getByLabel("Nombre").fill("Nequi del negocio");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardaste Nequi del negocio.")).toBeVisible();

  // Efectivo ya está en facturas: no se borra y la confirmación ofrece desactivarlo.
  await page.getByRole("button", { name: "Borrar Efectivo" }).click();
  await page
    .getByRole("alertdialog", { name: "¿Borrar Efectivo?" })
    .getByRole("button", { name: "Borrar" })
    .click();
  const inUse = page.getByRole("alertdialog", {
    name: "No se puede borrar Efectivo",
  });
  await expect(
    inUse.getByText(
      "Este método ya está en facturas o gastos. Desactívalo en lugar de borrarlo.",
    ),
  ).toBeVisible();
  await inUse.getByRole("button", { name: "Desactivar" }).click();
  await expect(page.getByText("Desactivaste Efectivo.")).toBeVisible();
  await expect(list.filter({ hasText: "Efectivo" })).toContainText("Inactivo");

  // Nequi nunca se usó: se borra.
  await page.getByRole("button", { name: "Borrar Nequi del negocio" }).click();
  await page
    .getByRole("alertdialog", { name: "¿Borrar Nequi del negocio?" })
    .getByRole("button", { name: "Borrar" })
    .click();
  await expect(page.getByText("Borraste Nequi del negocio.")).toBeVisible();
  await expect(list).toHaveCount(2);

  // Banco es el único activo: no se puede desactivar.
  await page.getByRole("button", { name: "Editar Banco" }).click();
  dialog = page.getByRole("dialog", { name: "Editar método de pago" });
  await dialog.getByRole("switch", { name: /^Activo/ }).click();
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(
    dialog.getByText("Deja al menos un método de pago activo."),
  ).toBeVisible();
});

/** Los 5 gastos de la semilla, todos en el mes de hoy (seed_demo_money los deja hasta hoy). */
const SEED_MONTH_TOTAL = 3_440_000;

/** "$ 3.440.000" → 3440000. */
function pesos(text: string | null): number {
  return Number((text ?? "").replace(/\D/g, ""));
}

/** El total del periodo que muestra Gastos. */
async function periodTotal(page: Page): Promise<number> {
  const total = page.getByLabel(/^Total del periodo/);
  await expect(total).toBeVisible();
  return pesos(await total.getAttribute("aria-label"));
}

/** La suma de los valores de las filas que se ven en la lista. */
async function rowsTotal(page: Page): Promise<number> {
  const values = await page
    .getByRole("main")
    .getByRole("listitem")
    .locator("span.font-bold")
    .allTextContents();
  return values.reduce((sum, value) => sum + pesos(value), 0);
}

/** "YYYY-MM-DD" ± días, en UTC (los días ya son de Bogotá). */
function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * El hoy del servidor, del atributo max de la fecha del editor (no el reloj de la prueba: cerca
 * de la medianoche de Bogotá no coinciden). Espera a que el editor esté hidratado.
 */
async function editorToday(page: Page): Promise<string> {
  await expect(
    page.getByRole("heading", { name: "Editor de gastos" }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Categoría" })).toBeEnabled();
  return (await page.getByLabel("Fecha de pago").getAttribute("max")) ?? "";
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(page.getByRole("combobox", { name: label })).toHaveText(option);
}

/** Escribe el valor como una persona: clic, todo seleccionado y los números. */
async function typeAmount(page: Page, amount: string) {
  const field = page.getByLabel("Valor del gasto");
  await field.click();
  await field.press("ControlOrMeta+a");
  await field.pressSequentially(amount);
  await expect(field).toHaveValue(amount);
}

test("la dueña agrega, edita y borra un gasto, y el total del periodo cambia", async ({
  page,
}) => {
  await signIn(page, OWNER);
  await visit(page, "/pro");
  await page.getByRole("link", { name: "Gastos" }).first().click();
  await expect(page).toHaveURL(/\/pro\/gastos$/);
  // Abre en el mes de hoy, con los gastos de la semilla, y el total es la suma de las filas.
  await expect(
    page.getByRole("link", { name: "Mes", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(await periodTotal(page)).toBe(SEED_MONTH_TOTAL);
  expect(await rowsTotal(page)).toBe(SEED_MONTH_TOTAL);

  // Validaciones: lo que falta, cada campo al salir y la fecha que no va después de hoy.
  await page.getByRole("link", { name: "Agregar gasto" }).click();
  const today = await editorToday(page);
  const add = page.getByRole("button", { name: "Agregar gasto" });
  await expect(add).toBeDisabled();
  await expect(
    page.getByText("Falta: Nombre, Categoría, Valor del gasto."),
  ).toBeVisible();
  await expect(page.getByLabel("Fecha de pago")).toHaveValue(today);
  await page.getByLabel("Nombre").focus();
  await page.getByLabel("Nombre").blur();
  await expect(page.getByText("Escribe el nombre del gasto.")).toBeVisible();
  await typeAmount(page, "0");
  await page.getByLabel("Valor del gasto").blur();
  await expect(page.getByText("El valor debe ser mayor que 0.")).toBeVisible();
  await page.getByLabel("Fecha de pago").fill(shiftDay(today, 1));
  await expect(
    page.getByText("La fecha de pago no puede ser después de hoy."),
  ).toBeVisible();

  // Crear con una fecha del mes pasado: vuelve a Gastos en ese mes, con la fila y su total; el
  // mes de hoy no cambia.
  const lastMonth = `${shiftDay(`${today.slice(0, 7)}-01`, -1).slice(0, 7)}-15`;
  await page.getByLabel("Fecha de pago").fill(lastMonth);
  await page.getByLabel("Nombre").fill("Toallas nuevas");
  await choose(page, "Categoría", "Insumos");
  await typeAmount(page, "85000");
  await choose(page, "Método de pago", "Banco");
  await expect(page.getByText(/^Falta:/)).toHaveCount(0);
  await add.click();
  await expect(page.getByText("Gasto agregado.")).toBeVisible();
  await expect(page).toHaveURL(
    new RegExp(`/pro/gastos\\?periodo=mes&dia=${lastMonth}$`),
  );
  const row = page.getByRole("link", { name: /^Toallas nuevas/ });
  await expect(row).toContainText("Insumos · 15 ");
  await expect(row).toContainText("Banco");
  await expect(row).toContainText(/\$\s?85\.000/);
  const monthBefore = await periodTotal(page);
  expect(await rowsTotal(page)).toBe(monthBefore);

  // Editar: trae su fecha, su método y su valor; el valor cambia y el total también.
  await row.click();
  await expect(page.getByLabel("Nombre")).toHaveValue("Toallas nuevas");
  await expect(page.getByLabel("Fecha de pago")).toHaveValue(lastMonth);
  await expect(
    page.getByRole("combobox", { name: "Método de pago" }),
  ).toHaveText("Banco");
  await expect(page.getByLabel("Valor del gasto")).toHaveValue("85.000");
  await typeAmount(page, "90000");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
  await expect(row).toContainText(/\$\s?90\.000/);
  expect(await periodTotal(page)).toBe(monthBefore + 5_000);

  // Borrar: pide confirmar; "No, dejarlo" no borra. Atrás después de borrar no lleva al editor.
  await row.click();
  await page.getByRole("button", { name: "Borrar gasto" }).click();
  const confirm = page.getByRole("alertdialog", {
    name: "¿Borrar el gasto Toallas nuevas?",
  });
  await expect(confirm).toContainText("no se puede deshacer");
  await confirm.getByRole("button", { name: "No, dejarlo" }).click();
  await expect(confirm).toBeHidden();
  await page.getByRole("button", { name: "Borrar gasto" }).click();
  await confirm.getByRole("button", { name: "Sí, borrar" }).click();
  await expect(page.getByText("Gasto borrado.")).toBeVisible();
  await expect(page).toHaveURL(
    new RegExp(`/pro/gastos\\?periodo=mes&dia=${lastMonth}$`),
  );
  await expect(row).toHaveCount(0);
  expect(await periodTotal(page)).toBe(monthBefore - 85_000);
  await page.goBack();
  await expect(page).not.toHaveURL(/\/pro\/gastos\/[0-9a-f-]{36}/);

  // El mes de hoy quedó como estaba; un día sin gastos dice que no hay y su total es $ 0.
  await visit(page, `/pro/gastos?periodo=mes&dia=${today}`);
  expect(await periodTotal(page)).toBe(SEED_MONTH_TOTAL);
  await visit(page, "/pro/gastos?periodo=dia&dia=2026-01-01");
  await expect(page.getByText("No hay gastos en este periodo.")).toBeVisible();
  expect(await periodTotal(page)).toBe(0);
});

test("el método es opcional, y al editar sigue el que se desactivó", async ({
  page,
}) => {
  // Efectivo se desactiva después de usarlo en "Insumos de barbería" (semilla); Banco queda activo.
  await sql(
    `update public.payment_methods pm set is_active = (pm.name = 'Banco')
     from public.businesses b
     where pm.business_id = b.id and b.slug = 'barberia-la-clasica'
       and pm.name in ('Efectivo', 'Banco')`,
  );
  await signIn(page, OWNER);
  await visit(page, "/pro/gastos");

  // Al editar sale "Efectivo (inactivo)" y se guarda sin cambiarlo.
  await page.getByRole("link", { name: /^Insumos de barbería/ }).click();
  await editorToday(page);
  const method = page.getByRole("combobox", { name: "Método de pago" });
  await expect(method).toHaveText("Efectivo (inactivo)");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Insumos de barbería/ }),
  ).toContainText("Efectivo");

  // En uno nuevo, el inactivo no se ofrece; sin método, la fila sale sin método.
  await page.getByRole("link", { name: "Agregar gasto" }).click();
  await editorToday(page);
  await expect(method).toHaveText("Sin método de pago");
  await method.click();
  await expect(page.getByRole("option")).toHaveText([
    "Sin método de pago",
    "Banco",
  ]);
  await page.keyboard.press("Escape");
  await page.getByLabel("Nombre").fill("Propinas del aseo");
  await choose(page, "Categoría", "Otros");
  await typeAmount(page, "20000");
  await page.getByRole("button", { name: "Agregar gasto" }).click();
  await expect(page.getByText("Gasto agregado.")).toBeVisible();
  const row = page.getByRole("link", { name: /^Propinas del aseo/ });
  await expect(row).toContainText("Otros");
  await expect(row).not.toContainText("Banco");
});

test("el campo de dinero no pierde lo que se escribe al entrar", async ({
  page,
}) => {
  await signIn(page, OWNER);
  await visit(page, "/pro/gastos/nuevo");
  await editorToday(page);
  // El primer número entra en el mismo instante del foco, antes del cuadro siguiente: si el campo
  // volviera a seleccionar todo en ese cuadro, el "5" reemplazaría al "8".
  await page.evaluate(() => {
    const input = document.getElementById("amount") as HTMLInputElement;
    input.focus();
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setValue?.call(input, "8");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.keyboard.type("5000");
  await expect(page.getByLabel("Valor del gasto")).toHaveValue("85000");
});

test("el profesional no ve Gastos: ni en el inicio ni por la dirección", async ({
  page,
}) => {
  const [expense] = await sql<{ id: string }>(
    `select e.id from public.expenses e join public.businesses b on b.id = e.business_id
     where b.slug = 'barberia-la-clasica' limit 1`,
  );
  await signIn(page, STAFF);
  await visit(page, "/pro");
  await expect(
    page.getByRole("link", { name: "Facturas" }).first(),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Gastos" })).toHaveCount(0);
  for (const path of [
    "/pro/gastos",
    "/pro/gastos/nuevo",
    `/pro/gastos/${expense.id}`,
  ]) {
    await visit(page, path);
    await expect(page).toHaveURL(/\/pro$/);
  }
});
