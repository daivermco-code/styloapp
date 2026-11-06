// Fase 10 (T-10.3.1): Clientes con sus pestañas, la búsqueda y los próximos cumpleaños (US-047),
// crear y editar un cliente con su ficha (US-048), Usuarios bloqueados (US-049) y Agendas
// recurrentes con "Eliminar serie" (US-050). El profesional no entra a ninguna de ellas.
import { expect, type Locator, type Page, test } from "@playwright/test";
import { sql } from "../db/helpers";
import { signIn, visit } from "./helpers";

const OWNER = "3005550101"; // Valentina Ríos, Barbería La Clásica
const STAFF = "3005550111"; // Camilo Rojas, del mismo negocio
const SLUG = "barberia-la-clasica";
const NEW_CLIENT_PHONE = "3005550397";

// Cada proyecto (navegador y tamaño) empieza con la demo como nueva.
test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

async function clientId(name: string): Promise<string> {
  const [row] = await sql<{ id: string }>(
    `select c.id from public.clients c join public.businesses b on b.id = c.business_id
     where b.slug = $1 and c.full_name = $2`,
    [SLUG, name],
  );
  return row.id;
}

function clientRows(page: Page): Locator {
  return page.getByRole("list", { name: "Clientes" }).getByRole("listitem");
}

/** El número del dato de cada fila ("25 visitas", "12 días"), en el orden de la lista. */
async function rowNumbers(rows: Locator): Promise<number[]> {
  // innerText y no textContent: así el celular ("… 0212") no se pega al número ("25 visitas").
  const texts = await rows.allInnerTexts();
  return texts.map((text) =>
    Number(text.trim().match(/(?:^|\s)(\d+) (?:visitas?|días?)$/)?.[1]),
  );
}

function isDescending(values: number[]): boolean {
  return values.every(
    (value, index) => index === 0 || values[index - 1] >= value,
  );
}

async function openTab(page: Page, label: string, query: RegExp) {
  await page
    .getByRole("navigation", { name: "Pestañas de clientes" })
    .getByRole("link", { name: label })
    .click();
  await expect(page).toHaveURL(query);
}

test("la dueña busca y ordena sus clientes por pestaña", async ({ page }) => {
  // Paula Osorio cumple dentro de 5 días: la única de la demo con fecha de nacimiento.
  await sql(
    `update public.clients c set birth_date =
       ((now() at time zone 'America/Bogota')::date + 5) - interval '30 years'
     from public.businesses b
     where b.id = c.business_id and b.slug = $1 and c.full_name = 'Paula Osorio'`,
    [SLUG],
  );
  await signIn(page, OWNER);
  await visit(page, "/pro/clientes");
  const rows = clientRows(page);
  await expect(rows.first()).toContainText("Adriana Montoya");
  await expect(rows.filter({ hasText: "Valeria Jiménez" })).toContainText(
    "(bloqueado)",
  );

  // Mejores clientes: los de más visitas primero.
  await openTab(page, "Mejores clientes", /pestana=mejores/);
  await expect(page.getByText("Clientes con más visitas")).toBeVisible();
  await expect(rows.first()).toContainText(/\d+ visitas$/);
  expect(isDescending(await rowNumbers(rows))).toBe(true);

  // No han vuelto: los que llevan más días sin venir primero.
  await openTab(page, "No han vuelto", /pestana=no-vuelven/);
  await expect(page.getByText("Días desde su última visita")).toBeVisible();
  await expect(rows.first()).toContainText(/\d+ días?$/);
  expect(isDescending(await rowNumbers(rows))).toBe(true);

  // Aún no te visitan: en la demo, todos han venido.
  await openTab(page, "Aún no te visitan", /pestana=sin-visitas/);
  await expect(
    page.getByText("No hay clientes en esta pestaña."),
  ).toBeVisible();

  // La búsqueda va en la URL y se queda al cambiar de pestaña.
  await openTab(page, "Todos", /\/pro\/clientes$/);
  const search = page.getByRole("searchbox", { name: "Buscar cliente" });
  await search.fill("osorio");
  await expect(page).toHaveURL(/q=osorio/);
  await expect(rows).toHaveText([
    /Ana María Osorio/,
    /Carlos Osorio/,
    /Paula Osorio/,
  ]);
  await openTab(page, "Mejores clientes", /pestana=mejores&q=osorio/);
  await expect(rows).toHaveCount(3);
  await openTab(page, "Todos", /\/pro\/clientes\?q=osorio$/);
  await search.fill("0312");
  await expect(rows).toHaveText([/Paula Osorio/]);
  await search.fill("zzz");
  await expect(
    page.getByText("No hay clientes que coincidan con la búsqueda."),
  ).toBeVisible();
  await search.fill("");
  await expect(page).toHaveURL(/\/pro\/clientes$/);

  // Próximos cumpleaños: solo los que cumplen en los próximos 30 días.
  await page.getByRole("link", { name: "Próximos cumpleaños" }).click();
  await expect(page).toHaveURL(/cumple=1/);
  await expect(rows).toHaveText([/Paula Osorio.*Cumple el/]);
});

test("la dueña crea un cliente, lo edita y ve su ficha", async ({ page }) => {
  await signIn(page, OWNER);
  await visit(page, "/pro/clientes");
  await page.getByRole("link", { name: "Crear cliente" }).click();
  await expect(page).toHaveURL(/\/pro\/clientes\/nuevo$/);
  const save = page.getByRole("button", { name: "Crear" });
  await expect(page.getByText("Falta: Nombre.")).toBeVisible();
  await expect(save).toBeDisabled();

  await page.getByLabel("Nombre").fill("Laura Benítez");
  // Pegado con el +57 y espacios: se queda con los 10 dígitos.
  await page.getByLabel("Número de contacto").fill("+57 300 555 0397");
  await expect(page.getByLabel("Número de contacto")).toHaveValue(
    NEW_CLIENT_PHONE,
  );
  await page.getByLabel("Notas").fill("Prefiere la máquina en 2.");
  await save.click();
  await expect(page.getByText("Cliente creado.")).toBeVisible();
  await expect(page).toHaveURL(/\/pro\/clientes\/[0-9a-f-]{36}$/);

  // La ficha: celular, notas, sin citas ni facturas todavía.
  const data = page.getByRole("region", { name: "Datos del cliente" });
  await expect(data).toContainText("+57 300 555 0397");
  await expect(page.getByText("Prefiere la máquina en 2.")).toBeVisible();
  await expect(page.getByText("Todavía no tiene citas.")).toBeVisible();
  // En el computador, el menú de módulos de al lado también tiene "Facturas".
  await page
    .getByRole("navigation", { name: "Historial del cliente" })
    .getByRole("link", { name: "Facturas" })
    .click();
  await expect(page).toHaveURL(/pestana=facturas/);
  await expect(page.getByText("Todavía no tiene facturas.")).toBeVisible();

  // Editar: el nombre y la fecha de nacimiento. Las notas llegan al editor (client_notes, arreglo 5
  // de la revisión) y no se pierden al guardar.
  await page.getByRole("link", { name: "Editar cliente" }).click();
  await expect(page).toHaveURL(/\/editar$/);
  await expect(page.getByLabel("Nombre")).toHaveValue("Laura Benítez");
  await expect(page.getByLabel("Notas")).toHaveValue(
    "Prefiere la máquina en 2.",
  );
  await page.getByLabel("Nombre").fill("Laura Benítez Gil");
  await page.getByLabel("Fecha de nacimiento").fill("1995-03-14");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
  await expect(page).toHaveURL(/\/pro\/clientes\/[0-9a-f-]{36}$/);
  await expect(data).toContainText("+57 300 555 0397 · cumple el 14 mar");
  await expect(page.getByText("Prefiere la máquina en 2.")).toBeVisible();

  // Ya está en "Aún no te visitan".
  await visit(page, "/pro/clientes?pestana=sin-visitas");
  await expect(clientRows(page)).toHaveText([/Laura Benítez Gil.*Sin visitas/]);

  // Con cuenta en la app, el celular solo se ve: lo cambia el cliente.
  await visit(
    page,
    `/pro/clientes/${await clientId("Alejandro Moreno")}/editar`,
  );
  const phone = page.getByLabel("Número de contacto");
  await expect(phone).toHaveValue("3005550201");
  await expect(phone).toHaveAttribute("readonly", "");
  await expect(
    page.getByText(
      "Tiene cuenta en la app: el celular lo cambia el cliente desde ella.",
    ),
  ).toBeVisible();
});

test("la dueña bloquea desde la ficha y desbloquea en Usuarios bloqueados", async ({
  page,
}) => {
  await signIn(page, OWNER);
  await visit(page, `/pro/clientes/${await clientId("Luis Bermúdez")}`);
  await expect(page.getByText(/reputación|Sin calificaciones/)).toBeVisible();
  await page.getByRole("button", { name: "Bloquear usuario" }).click();
  await page
    .getByRole("alertdialog", { name: "¿Bloquear a Luis Bermúdez?" })
    .getByRole("button", { name: "Sí, bloquear" })
    .click();
  await expect(page.getByText("Bloqueaste a Luis Bermúdez")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Desbloquear usuario" }),
  ).toBeVisible();

  await visit(page, "/pro/configurar");
  await page.getByRole("link", { name: /^Usuarios bloqueados/ }).click();
  await expect(page).toHaveURL(/\/pro\/configurar\/bloqueados$/);
  const blocked = page
    .getByRole("list", { name: "Clientes bloqueados" })
    .getByRole("listitem");
  await expect(blocked).toHaveText([/Luis Bermúdez/, /Valeria Jiménez/]);

  for (const name of ["Valeria Jiménez", "Luis Bermúdez"]) {
    await page.getByRole("button", { name: `Desbloquear a ${name}` }).click();
    await page
      .getByRole("alertdialog", { name: `¿Desbloquear a ${name}?` })
      .getByRole("button", { name: "Sí, desbloquear" })
      .click();
    await expect(page.getByText(`Desbloqueaste a ${name}`)).toBeVisible();
  }
  await expect(
    page.getByText("No has bloqueado a ningún cliente."),
  ).toBeVisible();
});

test("la dueña elimina una agenda recurrente y se cancelan sus citas", async ({
  page,
}) => {
  await signIn(page, OWNER);
  await visit(page, "/pro/configurar");
  await page.getByRole("link", { name: /^Agendas recurrentes/ }).click();
  await expect(page).toHaveURL(/\/pro\/configurar\/recurrentes$/);
  const series = page
    .getByRole("list", { name: "Series" })
    .getByRole("listitem");
  // Las dos de la demo se crean en el mismo instante: su orden cambia de un reinicio a otro.
  await expect(series).toHaveCount(2);
  await expect(series.filter({ hasText: "Adriana Montoya" })).toContainText(
    "Cada 15 días",
  );
  const card = series.filter({ hasText: "Sebastián Peña" });
  await expect(card).toContainText("Corte clásico con Julián");
  await expect(card).toContainText("Cada semana · martes 10:00 a. m.");
  const left = Number(
    (await card.textContent())?.match(/Quedan? (\d+) citas?/)?.[1],
  );
  expect(left).toBeGreaterThan(1);
  // Las citas que le faltan a la serie, para ver después que quedaron canceladas.
  const pending = await sql<{ id: string }>(
    `select k.id from public.bookings k
     join public.recurring_bookings r on r.id = k.recurring_id
     join public.clients c on c.id = r.client_id
     join public.businesses b on b.id = r.business_id
     where b.slug = $1 and c.full_name = 'Sebastián Peña'
       and k.status = 'pending' and k.starts_at > now()`,
    [SLUG],
  );
  expect(pending).toHaveLength(left);

  // "No, dejarla" no borra nada.
  await page
    .getByRole("button", { name: "Eliminar la serie de Sebastián Peña" })
    .click();
  let dialog = page.getByRole("alertdialog", {
    name: "¿Eliminar la serie de Sebastián Peña?",
  });
  await expect(dialog).toContainText(
    `Se cancelan las ${left} citas que faltan.`,
  );
  await dialog.getByRole("button", { name: "No, dejarla" }).click();
  await expect(series).toHaveCount(2);

  await page
    .getByRole("button", { name: "Eliminar la serie de Sebastián Peña" })
    .click();
  dialog = page.getByRole("alertdialog", {
    name: "¿Eliminar la serie de Sebastián Peña?",
  });
  await dialog.getByRole("button", { name: "Sí, eliminar" }).click();
  await expect(
    page.getByText(`Eliminaste la serie y se cancelaron ${left} citas.`),
  ).toBeVisible();
  await expect(series).toHaveText([/Adriana Montoya/]);
  await expect(
    page.getByRole("link", { name: "Agendar una cita" }),
  ).toHaveAttribute("href", "/pro/agenda/nueva");

  // En la base: la serie ya no está y sus citas que faltaban quedaron canceladas.
  const [row] = await sql<{ series: string; cancelled: string }>(
    `select (select count(*) from public.recurring_bookings r
             where r.business_id = b.id) as series,
            (select count(*) from public.bookings k
             where k.id = any($2::uuid[]) and k.status = 'cancelled') as cancelled
     from public.businesses b where b.slug = $1`,
    [SLUG, pending.map((booking) => booking.id)],
  );
  expect(row).toEqual({ series: "1", cancelled: String(left) });

  // Sebastián tiene cuenta: le llega un aviso de "Cita cancelada" por cada una.
  const [notices] = await sql<{ count: string }>(
    `select count(*) from public.demo_messages
     where kind = 'booking_cancelled' and booking_id = any($1::uuid[])
       and recipient_phone = '+573005550125'`,
    [pending.map((booking) => booking.id)],
  );
  expect(notices.count).toBe(String(left));
});

test("el profesional no entra a Clientes, Bloqueados ni Recurrentes", async ({
  page,
}) => {
  await signIn(page, STAFF);
  for (const url of [
    "/pro/clientes",
    "/pro/clientes/nuevo",
    "/pro/configurar/bloqueados",
    "/pro/configurar/recurrentes",
  ]) {
    await visit(page, url);
    await expect(page).toHaveURL(/\/pro$/);
  }
});
