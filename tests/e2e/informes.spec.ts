// Fase 13, Informes (US-052 a US-057, T-13.3.1): la dueña entra desde el inicio, cambia de
// pestaña, de periodo y de profesional, pone un rango (con sus errores) y lo quita; los números
// cuadran con Facturas y Gastos en Día, Semana, Quincena y Mes (el Año lo cuadra la prueba de
// base, tests/db/reportes.test.ts). El profesional ve tres pestañas, solo lo suyo, y la URL con
// otro profesional o con Métodos de pago no le muestra nada ajeno.
import { expect, type Page, test } from "@playwright/test";
import { sql } from "../db/helpers";
import { signIn, visit } from "./helpers";

const OWNER = "3005550101"; // Valentina Ríos, Barbería La Clásica
const STAFF = "3005550111"; // Camilo Rojas, del mismo negocio

test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

/** "$ 1.250.000" → 1250000; "−$ 80.000" → -80000. */
function pesos(text: string | null): number {
  const value = Number((text ?? "").replace(/\D/g, ""));
  return (text ?? "").trim().startsWith("−") ? -value : value;
}

/** Un día con ventas de los meses de antes, el último antes de las dos semanas recientes. */
async function seedDay(): Promise<string> {
  const [row] = await sql<{ day: string }>(
    `select max(i.issued_on)::text as day from public.invoices i
     join public.businesses b on b.id = i.business_id and b.slug = 'barberia-la-clasica'
     where i.booking_id is null`,
  );
  return row.day;
}

async function staffId(name: string): Promise<string> {
  const [row] = await sql<{ id: string }>(
    `select s.id from public.staff s
     join public.businesses b on b.id = s.business_id and b.slug = 'barberia-la-clasica'
     where s.display_name = $1`,
    [name],
  );
  return row.id;
}

/** El valor de una tarjeta de Indicadores generales. */
async function card(page: Page, title: string): Promise<number> {
  const value = page.getByRole("region", { name: title }).locator("p").first();
  await expect(value).toBeVisible();
  return pesos(await value.textContent());
}

/** El pie de Facturas en pesos. */
async function invoiceTotals(page: Page, query: string) {
  await visit(page, `/pro/facturas?${query}`);
  const footer = page.locator('footer[aria-label="Totales del periodo"]');
  await expect(footer).toBeVisible();
  const value = async (label: string) =>
    pesos(
      await footer
        .locator("div", { hasText: label })
        .locator("dd")
        .textContent(),
    );
  return {
    sales: await value("Total ventas"),
    commissions: await value("Total comisiones"),
  };
}

/** El total del periodo de Gastos. */
async function expenseTotal(page: Page, query: string): Promise<number> {
  await visit(page, `/pro/gastos?${query}`);
  const total = page.getByLabel(/^Total del periodo/);
  await expect(total).toBeVisible();
  return pesos(await total.getAttribute("aria-label"));
}

test("los números de Informes cuadran con Facturas y Gastos", async ({
  page,
}) => {
  const day = await seedDay();
  await signIn(page, OWNER);
  for (const period of ["dia", "semana", "quincena", "mes"]) {
    const query = `periodo=${period}&dia=${day}`;
    await visit(page, `/pro/informes?${query}`);
    const sales = await card(page, "Ventas generales");
    const services = await card(page, "Venta de servicios");
    const expenses = await card(page, "Gastos");
    const commissions = await card(page, "Pago de comisiones");
    const profit = await card(page, "Utilidades");
    expect(await card(page, "Venta de productos")).toBe(0);
    expect(services).toBe(sales);
    expect(profit, period).toBe(sales - expenses - commissions);

    const invoices = await invoiceTotals(page, query);
    expect(sales, period).toBe(invoices.sales);
    expect(commissions, period).toBe(invoices.commissions);
    expect(sales, period).toBeGreaterThan(0);
    // Gastos tiene Día, Semana y Mes; la quincena se cuadra en la prueba de base.
    if (period !== "quincena") {
      expect(expenses, period).toBe(await expenseTotal(page, query));
    }
  }
});

test("la dueña cambia de pestaña, de periodo, de profesional y de rango", async ({
  page,
}) => {
  const day = await seedDay();
  const julian = await staffId("Julián");
  await signIn(page, OWNER);

  // Desde el inicio: abre en Día, Indicadores generales y Todos, con las 6 tarjetas.
  await visit(page, "/pro");
  await page.getByRole("link", { name: "Informes" }).first().click();
  await expect(page).toHaveURL(/\/pro\/informes$/);
  await expect(
    page.getByRole("link", { name: "Día", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  const tabs = page.getByRole("navigation", { name: "Informe" });
  await expect(tabs.getByRole("link")).toHaveText([
    "Indicadores generales",
    "Ventas",
    "Comisiones",
    "Métodos de pago",
  ]);
  await expect(
    tabs.getByRole("link", { name: "Indicadores generales" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("navigation", { name: "Profesional" }).getByRole("link", {
      name: "Todos",
    }),
  ).toHaveAttribute("aria-current", "page");
  for (const title of [
    "Ventas generales",
    "Venta de servicios",
    "Venta de productos",
    "Gastos",
    "Pago de comisiones",
    "Utilidades",
  ]) {
    await expect(page.getByRole("region", { name: title })).toBeVisible();
  }
  await expect(page.getByText("Llegan después")).toBeVisible();

  // El mes del día de la semilla, y la flecha al anterior.
  await visit(page, `/pro/informes?periodo=mes&dia=${day}`);
  await expect(page.getByText(/^Mes: /)).toBeVisible();
  const label = await page.getByText(/^Mes: /).textContent();
  // Como en Facturas, las flechas reemplazan la dirección: recargar deja el mes elegido.
  await page.getByRole("link", { name: "Periodo anterior" }).click();
  await expect(page.getByText(/^Mes: /)).not.toHaveText(label ?? "");
  const before = await page.getByText(/^Mes: /).textContent();
  await page.reload();
  await expect(page.getByText(/^Mes: /)).toHaveText(before ?? "");
  await page.getByRole("link", { name: "Periodo siguiente" }).click();
  await expect(page.getByText(/^Mes: /)).toHaveText(label ?? "");

  // Ventas: filas por servicio, de mayor a menor.
  await tabs.getByRole("link", { name: "Ventas" }).click();
  await expect(page).toHaveURL(/pestana=ventas/);
  const sales = page.getByRole("region", { name: "Ventas por servicio" });
  await expect(sales.getByRole("listitem").first()).toContainText(/veces?/);
  // Comisiones: el equipo sin la dueña; ganado = pagado + falta.
  await tabs.getByRole("link", { name: "Comisiones" }).click();
  const commissions = page.getByRole("region", {
    name: "Comisiones por profesional",
  });
  await expect(commissions.getByRole("listitem")).toHaveCount(3);
  await expect(commissions).not.toContainText("Valentina");
  // Métodos de pago: los porcentajes suman 100.
  await tabs.getByRole("link", { name: "Métodos de pago" }).click();
  const methods = page.getByRole("region", {
    name: "Ventas por método de pago",
  });
  await expect(methods.getByRole("listitem").first()).toBeVisible();
  const shares = (await methods.getByRole("listitem").allTextContents()).map(
    (text) => Number(text.match(/(\d+) %/)?.[1] ?? 0),
  );
  expect(shares.reduce((sum, value) => sum + value, 0)).toBe(100);

  // Un profesional: Métodos de pago dice que es del negocio; en Indicadores no salen Gastos ni
  // Utilidades, y una línea dice por qué.
  await page
    .getByRole("navigation", { name: "Profesional" })
    .getByRole("link", { name: "Julián" })
    .click();
  await expect(page).toHaveURL(new RegExp(`pro=${julian}`));
  await expect(
    page.getByText(
      "Los métodos de pago son del negocio: elige Todos para verlos.",
    ),
  ).toBeVisible();
  await tabs.getByRole("link", { name: "Indicadores generales" }).click();
  await expect(
    page.getByText(
      "Gastos y utilidades son del negocio: elige Todos para verlos.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Gastos" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Utilidades" })).toHaveCount(0);
  const julianSales = await card(page, "Ventas generales");
  const julianInvoices = await invoiceTotals(
    page,
    `periodo=mes&dia=${day}&pro=${julian}`,
  );
  expect(julianSales).toBe(julianInvoices.sales);
});

test("Filtrar: Rango dice qué falta, revisa las fechas y se quita con la x", async ({
  page,
}) => {
  const day = await seedDay();
  const from = `${day.slice(0, 7)}-01`;
  await signIn(page, OWNER);
  await visit(page, `/pro/informes?periodo=semana&dia=${day}`);
  await page.getByRole("button", { name: "Filtrar: Rango" }).click();
  const sheet = page.getByRole("dialog", { name: "Filtrar: Rango" });
  const apply = sheet.getByRole("button", { name: "Aplicar" });
  await expect(sheet.getByText("Falta: Desde, Hasta.")).toBeVisible();
  await expect(apply).toBeDisabled();

  // Al revés y de más de un año: el error va debajo de Hasta.
  await sheet.getByLabel("Desde").fill(day);
  await expect(sheet.getByText("Falta: Hasta.")).toBeVisible();
  await sheet.getByLabel("Hasta").fill(from);
  if (from !== day) {
    await expect(
      sheet.getByText("Hasta no puede ser antes de Desde."),
    ).toBeVisible();
    await expect(apply).toBeDisabled();
  }
  await sheet.getByLabel("Desde").fill("2020-01-01");
  await sheet.getByLabel("Hasta").fill("2021-06-01");
  await expect(
    sheet.getByText("El rango puede ser de hasta un año."),
  ).toBeVisible();
  await expect(apply).toBeDisabled();

  // Del primero del mes al día de la semilla: los chips quedan sin elegir y no hay flechas.
  await sheet.getByLabel("Desde").fill(from);
  await sheet.getByLabel("Hasta").fill(day);
  await expect(sheet.getByText(/^Falta:/)).toHaveCount(0);
  await apply.click();
  await expect(page).toHaveURL(new RegExp(`desde=${from}&hasta=${day}`));
  await expect(
    page.getByText(/^Del \d+ \w+ al \d+ \w+ de \d{4}$/),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Periodo" }).locator("[aria-current]"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Periodo anterior" }),
  ).toHaveCount(0);
  const ranged = await card(page, "Ventas generales");
  // Lo mismo que Facturas en esas fechas, sumando los días.
  const [direct] = await sql<{ total: number }>(
    `select coalesce(sum(i.total), 0)::int as total from public.invoices i
     join public.businesses b on b.id = i.business_id and b.slug = 'barberia-la-clasica'
     where i.status = 'paid' and i.issued_on between $1 and $2`,
    [from, day],
  );
  expect(ranged).toBe(direct.total);

  // La x vuelve a la semana de antes; recargar deja todo igual.
  await page.getByRole("link", { name: "Quitar el rango" }).click();
  await expect(page).toHaveURL(new RegExp(`periodo=semana&dia=${day}$`));
  await expect(
    page.getByRole("link", { name: "Semana", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(page.getByText(/^Semana: /)).toBeVisible();
});

test("el profesional ve tres pestañas y solo lo suyo, aunque cambie la URL", async ({
  page,
}) => {
  const day = await seedDay();
  const julian = await staffId("Julián");
  await signIn(page, STAFF);
  await visit(page, "/pro");
  await page.getByRole("link", { name: "Informes" }).first().click();
  await expect(page).toHaveURL(/\/pro\/informes$/);
  const tabs = page.getByRole("navigation", { name: "Informe" });
  await expect(tabs.getByRole("link")).toHaveText([
    "Indicadores generales",
    "Ventas",
    "Comisiones",
  ]);
  await expect(
    page.getByRole("navigation", { name: "Profesional" }),
  ).toHaveCount(0);

  // Con otro profesional y Métodos de pago en la URL: Indicadores generales, con lo suyo.
  await visit(
    page,
    `/pro/informes?pestana=metodos&periodo=mes&dia=${day}&pro=${julian}`,
  );
  await expect(
    tabs.getByRole("link", { name: "Indicadores generales" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("region", { name: "Gastos" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Utilidades" })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Pago de comisiones" }),
  ).toBeVisible();
  const own = await card(page, "Ventas generales");
  const ownCommissions = await card(page, "Pago de comisiones");
  const invoices = await invoiceTotals(page, `periodo=mes&dia=${day}`);
  expect(own).toBe(invoices.sales);
  expect(ownCommissions).toBe(invoices.commissions);

  // Comisiones: solo su fila.
  await visit(page, `/pro/informes?pestana=comisiones&periodo=mes&dia=${day}`);
  const rows = page
    .getByRole("region", { name: "Comisiones por profesional" })
    .getByRole("listitem");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Camilo");
});
