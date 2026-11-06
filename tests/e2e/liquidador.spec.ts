// Fase 9, liquidador e historial de pagos (US-045 y US-046, T-9.4.1): lo que dice el liquidador
// cuadra con "Total comisiones" de Facturas; se marcan las dos citas de Camilo que deja la semilla,
// se le paga y el pago sale en el historial; la factura pagada ya no se edita ni se anula; el
// profesional no ve nada de esto.
import { expect, type Page, test } from "@playwright/test";
import { sql } from "../db/helpers";
import { screenProblems, signIn, visit } from "./helpers";

const OWNER = "3005550101"; // Valentina Ríos, Barbería La Clásica
const STAFF = "3005550111"; // Camilo Rojas, del mismo negocio

// Cada proyecto (navegador y tamaño) empieza con la demo como nueva.
test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

/** "$ 96.000" → 96000. */
function pesos(text: string | null): number {
  return Number((text ?? "").replace(/\D/g, ""));
}

/** 96000 → "\$\s?96\.000" (formatCOP pone un espacio duro), para armar un RegExp. */
function moneyPattern(value: number): string {
  return `\\$\\s?${value.toLocaleString("es-CO").replaceAll(".", "\\.")}`;
}

function money(value: number): RegExp {
  return new RegExp(moneyPattern(value));
}

type Seed = {
  camilo: string;
  today: string;
  /** El día de la factura pendiente más vieja de Camilo. */
  oldest: string;
  /** Sus servicios pendientes y de cuántas facturas salen. */
  items: number;
  invoices: number;
};

const SHORT_MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sept",
  "oct",
  "nov",
  "dic",
];
const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** "2026-10-22" → "22 oct". */
function dayMonth(day: string): string {
  return `${Number(day.slice(8))} ${SHORT_MONTHS[Number(day.slice(5, 7)) - 1]}`;
}

/** "1 servicio", "8 servicios". */
function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Las comisiones de las filas de una sección ("Servicios pendientes", "Servicios que cubrió"). */
async function sectionCommissions(page: Page, name: string): Promise<number[]> {
  const values = await page
    .getByRole("region", { name })
    .getByRole("listitem")
    .locator("span.font-bold")
    .allTextContents();
  return values.map(pesos);
}

/** Camilo, hoy en Bogotá (el reloj de la base, el mismo del servidor) y su pendiente más viejo. */
async function seed(): Promise<Seed> {
  const [row] = await sql<Seed>(
    `select s.id as camilo,
            to_char((now() at time zone 'America/Bogota')::date, 'YYYY-MM-DD') as today,
            to_char(min(i.issued_on), 'YYYY-MM-DD') as oldest,
            count(ii.id)::int as items, count(distinct i.id)::int as invoices
     from public.staff s
     join public.businesses b on b.id = s.business_id and b.slug = 'barberia-la-clasica'
     join public.invoice_items ii on ii.staff_id = s.id and ii.staff_payment_id is null
     join public.invoices i on i.id = ii.invoice_id and i.status = 'paid'
     where s.display_name = 'Camilo'
     group by s.id`,
  );
  return row;
}

/** "Total comisiones" de Facturas, para Camilo, en el mes de ese día. */
async function monthCommissions(
  page: Page,
  staffId: string,
  day: string,
): Promise<number> {
  await visit(page, `/pro/facturas?periodo=mes&dia=${day}&pro=${staffId}`);
  const footer = page.locator('footer[aria-label="Totales del periodo"]');
  await expect(footer).toBeVisible();
  return pesos(
    await footer
      .locator("div", { hasText: "Total comisiones" })
      .locator("dd")
      .textContent(),
  );
}

/** La tarjeta de un profesional en el liquidador. */
function card(page: Page, name: string) {
  return page.getByRole("main").getByRole("listitem").filter({ hasText: name });
}

test("el liquidador cuadra con Facturas, se marcan las citas, se paga y sale en el historial", async ({
  page,
}) => {
  const { camilo, today, oldest, items, invoices } = await seed();
  const oldestMonth = `${oldest.slice(0, 7)}-01`;
  await signIn(page, OWNER);

  // Lo pendiente de Camilo es "Total comisiones" de sus facturas (todas pendientes: la semilla
  // solo le pagó a Julián), sumando los meses que tocan.
  let expected = await monthCommissions(page, camilo, oldestMonth);
  if (oldestMonth.slice(0, 7) !== today.slice(0, 7)) {
    expected += await monthCommissions(page, camilo, today);
  }
  expect(expected).toBeGreaterThan(0);

  // Desde el inicio, en "Mi negocio".
  await visit(page, "/pro");
  await page.getByRole("link", { name: "Liquidador" }).first().click();
  await expect(page).toHaveURL(/\/pro\/liquidador$/);
  const camiloCard = card(page, "Camilo");
  await expect(camiloCard).toContainText(
    `${plural(items, "servicio", "servicios")} de ${plural(invoices, "factura", "facturas")} · desde ${dayMonth(oldest)}`,
  );
  await expect(camiloCard).toContainText("2 citas sin marcar");
  await expect(camiloCard).toContainText(money(expected));

  // El detalle: primero las dos citas; Pagar no se puede hasta marcarlas, y dice por qué.
  await camiloCard.getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`\\?pro=${camilo}$`));
  const sheet = page.getByRole("dialog", { name: "Camilo", exact: true });
  await expect(
    sheet.getByText("Marca estas citas antes de pagarle a Camilo."),
  ).toBeVisible();
  const pay = sheet.getByRole("button", { name: "Pagar" });
  await expect(pay).toBeDisabled();
  await expect(pay).toHaveAccessibleDescription(
    "Marca las citas de arriba para poder pagar.",
  );
  const total = sheet.getByText("Total a pagar").locator("..");
  expect(pesos(await total.textContent())).toBe(expected);
  // Las filas son los servicios pendientes, y sus comisiones suman el total.
  const rows = await sectionCommissions(page, "Servicios pendientes");
  expect(rows).toHaveLength(items);
  expect(rows.reduce((sum, value) => sum + value, 0)).toBe(expected);

  // Cada grupo de caritas dice de qué cita es; se marcan las dos.
  const groups = sheet.getByRole("group", { name: /^Llegada de / });
  await expect(groups).toHaveCount(2);
  for (let marked = 0; marked < 2; marked++) {
    await groups.first().getByRole("button", { name: "A tiempo" }).click();
    await expect(groups).toHaveCount(1 - marked);
  }
  await expect(sheet.getByText(/^Marca estas citas/)).toHaveCount(0);
  await expect(pay).toBeEnabled();

  // Pagar: el valor es el del liquidador, el método va puesto y la fecha es hoy (el hoy del
  // servidor, en el máximo del campo: cerca de la medianoche no es el de la prueba).
  await pay.click();
  const dialog = page.getByRole("dialog", { name: "Pagarle a Camilo" });
  await expect(dialog.locator("dl")).toContainText(money(expected));
  expect(await screenProblems(page)).toEqual([]);
  const date = dialog.getByLabel("Fecha");
  const payDay = (await date.getAttribute("max")) ?? "";
  await expect(
    dialog.getByRole("combobox", { name: "Método de pago" }),
  ).toHaveText("Efectivo");
  await expect(date).toHaveValue(payDay);
  await dialog.getByLabel("Nota").fill("Quincena de prueba");
  await dialog.getByRole("button", { name: "Confirmar pago" }).click();
  await expect(
    page.getByText(
      new RegExp(`^Le pagaste ${moneyPattern(expected)} a Camilo\\.$`),
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/pro\/liquidador$/);
  await expect(card(page, "Camilo")).toContainText("Sin comisiones pendientes");
  await expect(card(page, "Camilo").getByRole("link")).toHaveCount(0);

  // Su hoja, sin nada pendiente, lo dice y no ofrece Pagar.
  await visit(page, `/pro/liquidador?pro=${camilo}`);
  await expect(
    page.getByText("Camilo no tiene comisiones pendientes."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Pagar" })).toHaveCount(0);

  // El historial: arriba el mes del pago y, primero, el de Camilo, con su día, método y valor.
  await visit(page, "/pro");
  await page.getByRole("link", { name: "Historial de pagos" }).first().click();
  await expect(page).toHaveURL(/\/pro\/pagos$/);
  const month = page.getByRole("main").locator("section").first();
  await expect(month).toHaveAccessibleName(
    `${MONTHS[Number(payDay.slice(5, 7)) - 1]} de ${payDay.slice(0, 4)}`,
  );
  const payment = month.getByRole("link").first();
  await expect(payment).toContainText("Camilo");
  await expect(payment).toContainText(`${dayMonth(payDay)} · Efectivo`);
  await expect(payment).toContainText(money(expected));
  await payment.click();
  await expect(
    page.getByRole("heading", { name: "Pago a Camilo" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText(money(expected));
  await expect(page.getByText("Nota: Quincena de prueba")).toBeVisible();
  // Cubrió los mismos servicios que estaban pendientes.
  const covered = await sectionCommissions(page, "Servicios que cubrió");
  expect(covered).toHaveLength(items);
  expect(covered.reduce((sum, value) => sum + value, 0)).toBe(expected);

  // La factura que cubrió ya no se edita ni se anula, y dice a quién se le pagó.
  await page
    .getByRole("link", { name: /^Factura \d+/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/pro\/facturas\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/^Pagada a Camilo el /)).toBeVisible();
  await expect(page.getByRole("link", { name: "Editar factura" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Anular" })).toHaveCount(0);
});

test("el profesional no ve el liquidador ni el historial de pagos", async ({
  page,
}) => {
  const [paid] = await sql<{ id: string }>(
    `select sp.id from public.staff_payments sp
     join public.businesses b on b.id = sp.business_id
     where b.slug = 'barberia-la-clasica' limit 1`,
  );
  await signIn(page, STAFF);
  await visit(page, "/pro");
  await expect(
    page.getByRole("link", { name: "Facturas" }).first(),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Liquidador" })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Historial de pagos" }),
  ).toHaveCount(0);
  for (const path of [
    "/pro/liquidador",
    "/pro/pagos",
    `/pro/pagos/${paid.id}`,
  ]) {
    await visit(page, path);
    await expect(page).toHaveURL(/\/pro$/);
  }
});
