// Fase 14, Estadísticas (US-058, T-14.2.1): abrir la página de un negocio suma una visita y
// recargar no; las del equipo no cuentan. Seguir suma un seguidor que sale primero en la lista. El
// profesional entra desde el contador de seguidores y la dueña también desde Marketing y ventas;
// los números son los de la base.
import { expect, type Page, test } from "@playwright/test";
import { sql } from "../db/helpers";
import { signIn, visit } from "./helpers";

const OWNER = "3005550101"; // Valentina Ríos, Barbería La Clásica
const STAFF = "3005550111"; // Camilo Rojas, del mismo negocio
const CLIENT = "3005550122"; // Daniela Ruiz: no sigue La Clásica en la semilla
const SLUG = "barberia-la-clasica";

test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

async function businessId(): Promise<string> {
  const [row] = await sql<{ id: string }>(
    "select id from public.businesses where slug = $1",
    [SLUG],
  );
  return row.id;
}

async function visits(): Promise<number> {
  const [row] = await sql<{ count: string }>(
    `select count(*)::text as count from public.profile_visits v
     join public.businesses b on b.id = v.business_id and b.slug = $1`,
    [SLUG],
  );
  return Number(row.count);
}

async function insights() {
  const [row] = await sql<{
    followers: string;
    bookings: string;
    visits: string;
  }>(
    `select (select count(*) from public.follows f where f.business_id = b.id)::text as followers,
            (select count(*) from public.bookings k where k.business_id = b.id
               and k.booked_by = 'client' and k.status <> 'cancelled')::text as bookings,
            (select count(*) from public.profile_visits v where v.business_id = b.id)::text as visits
     from public.businesses b where b.slug = $1`,
    [SLUG],
  );
  return {
    followers: Number(row.followers),
    bookings: Number(row.bookings),
    visits: Number(row.visits),
  };
}

/** Si la persona de ese celular (10 dígitos) ya sigue La Clásica en la base. */
async function followsBusiness(digits: string): Promise<boolean> {
  const rows = await sql(
    `select 1 from public.follows f
     join public.profiles p on p.id = f.profile_id and p.phone = $1
     join public.businesses b on b.id = f.business_id and b.slug = $2`,
    [`+57${digits}`, SLUG],
  );
  return rows.length > 0;
}

/** El número de una tarjeta de Estadísticas. */
async function card(page: Page, label: string): Promise<number> {
  const value = page.getByRole("region", { name: label }).locator("p");
  await expect(value).toBeVisible();
  return Number((await value.textContent())?.replace(/\D/g, ""));
}

/** Espera a que la página termine de pedir, para ver que no sumó otra visita. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}

test("abrir la página del negocio suma una visita, recargar no y el equipo no cuenta", async ({
  page,
}) => {
  const id = await businessId();
  const before = await visits();

  await visit(page, `/app/negocio/${id}`);
  await expect.poll(visits).toBe(before + 1);
  await page.reload();
  await settle(page);
  expect(await visits()).toBe(before + 1);

  // Otra pestaña es otra visita, también por el enlace.
  const tab = await page.context().newPage();
  await visit(tab, `/n/${SLUG}`);
  await expect.poll(visits).toBe(before + 2);
  await tab.close();

  // El profesional del negocio abre su página: no cuenta.
  await signIn(page, STAFF);
  const staffTab = await page.context().newPage();
  await visit(staffTab, `/app/negocio/${id}`);
  await expect(
    staffTab.getByRole("heading", { level: 2 }).first(),
  ).toBeVisible();
  await settle(staffTab);
  expect(await visits()).toBe(before + 2);
});

test("seguir suma un seguidor, sale primero en la lista y el profesional entra desde el contador", async ({
  page,
}) => {
  const id = await businessId();
  await signIn(page, CLIENT);
  await visit(page, `/app/negocio/${id}`);
  await page.getByRole("button", { name: "Seguir" }).click();
  await expect(page.getByRole("button", { name: "Siguiendo" })).toBeVisible();
  // "Siguiendo" sale antes de guardar: esperar la fila en la base antes de salir, o el cambio de
  // sesión corta el guardado.
  await expect.poll(() => followsBusiness(CLIENT)).toBe(true);

  await page.context().clearCookies();
  await signIn(page, STAFF);
  await page.getByRole("link", { name: /Seguidores del negocio/ }).click();
  await expect(page).toHaveURL(/\/pro\/estadisticas$/);
  await expect(
    page.getByRole("heading", { name: "Estadísticas", level: 1 }),
  ).toBeVisible();

  const expected = await insights();
  expect(await card(page, "Seguidores")).toBe(expected.followers);
  expect(await card(page, "Reservas de usuarios")).toBe(expected.bookings);
  expect(await card(page, "Visitas al perfil")).toBe(expected.visits);

  const list = page.getByRole("region", { name: "Lista de seguidores" });
  const rows = list.getByRole("listitem");
  await expect(rows).toHaveCount(expected.followers);
  await expect(rows.first()).toContainText("Daniela Ruiz");
  await expect(rows.first()).toContainText(/Te sigue desde el \d{1,2} \w+/);
  // Solo el nombre y la fecha: nada del celular.
  await expect(list).not.toContainText("300");
});

test("la dueña entra desde Marketing y ventas y desde su contador; un cliente no entra", async ({
  page,
}) => {
  await signIn(page, OWNER);
  await page.getByRole("link", { name: "Estadísticas" }).first().click();
  await expect(page).toHaveURL(/\/pro\/estadisticas$/);
  expect(await card(page, "Seguidores")).toBe((await insights()).followers);

  await page.getByRole("link", { name: "Volver" }).click();
  await page.getByRole("link", { name: /Seguidores del negocio/ }).click();
  await expect(page).toHaveURL(/\/pro\/estadisticas$/);

  await page.context().clearCookies();
  await signIn(page, CLIENT);
  await visit(page, "/pro/estadisticas");
  await expect(page).not.toHaveURL(/\/pro\/estadisticas/);
});
