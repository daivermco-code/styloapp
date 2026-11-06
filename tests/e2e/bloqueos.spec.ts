// Fase 4 (US-020 a US-022, flujo E2E 4): la dueña cierra un espacio manteniendo presionada la
// grilla y esas horas dejan de salir en el editor y en la reserva del cliente; el profesional sin
// permiso ve el aviso; la dueña bloquea a un cliente desde su cita; y crea una serie con una fecha
// ocupada y cancela esa cita y las siguientes.
import { expect, type Page, test } from "@playwright/test";
import { sql } from "../db/helpers";
import { signIn, visit } from "./helpers";

const OWNER = "3005550101"; // Valentina Ríos, Barbería La Clásica
const STAFF = "3005550111"; // Camilo Rojas, del mismo negocio
const NO_PERMISSION =
  "Tu negocio no te ha dado permiso para bloquear espacios.";
const OVERLAP = "Ese espacio ya tiene una cita. Muévela o cancélala primero.";

test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

/** Un día en que Camilo trabaja (de 9:00 a. m. a 7:00 p. m.), después de las citas sembradas. */
async function emptyWorkday(): Promise<string> {
  const [{ day }] = await sql<{ day: string }>(
    `select to_char(d, 'YYYY-MM-DD') as day
     from generate_series((now() at time zone 'America/Bogota')::date + 23,
                          (now() at time zone 'America/Bogota')::date + 30, interval '1 day') d
     where extract(dow from d) <> 0
     order by d limit 1`,
  );
  return day;
}

async function camiloId(): Promise<string> {
  const [{ id }] = await sql<{ id: string }>(
    `select s.id from public.staff s join public.profiles p on p.id = s.profile_id
     where p.phone = '+573005550111'`,
  );
  return id;
}

/** Otra persona toma esa hora con Camilo: una cita sin cliente, directo en la base. */
async function takeSlot(day: string, clock: string): Promise<void> {
  await sql(
    `insert into public.bookings
       (business_id, staff_id, service_id, guest_name, starts_at, ends_at, price)
     select s.business_id, s.id, sv.id, 'Ramiro Castaño', t, t + interval '30 minutes', sv.price
     from public.staff s
     join public.profiles p on p.id = s.profile_id
     join public.services sv on sv.business_id = s.business_id and sv.name = 'Corte clásico'
     cross join lateral (select (($1::date + $2::time) at time zone 'America/Bogota') as t) x
     where p.phone = '+573005550111'`,
    [day, clock],
  );
}

/**
 * La grilla se ve antes de que React la conecte (en WebKit, varios segundos después) y hasta
 * entonces no responde al puntero ni a los toques: el botón de recargar se prende a la vez.
 */
async function agendaReady(page: Page): Promise<void> {
  await expect(
    page.getByRole("button", { name: "Recargar la agenda" }),
  ).toBeEnabled();
}

/**
 * Mantiene presionada la columna de Camilo en el cuarto de hora `quarter` contado desde las
 * 9:00 a. m. (la grilla empieza ahí): 30 px por cuarto, en el centro del cuadrito.
 */
async function holdQuarter(page: Page, quarter: number): Promise<void> {
  await agendaReady(page);
  const column = page.locator(`[data-staff="${await camiloId()}"]`);
  await expect(column).toBeVisible();
  const box = await column.boundingBox();
  if (!box) throw new Error("No se ve la columna de Camilo");
  await page.mouse.move(box.x + box.width / 2, box.y + quarter * 30 + 15);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
}

async function setManualBlock(value: boolean): Promise<void> {
  await sql(
    `update public.team_permissions set manual_block = $1
     where business_id = (select id from public.businesses where slug = 'barberia-la-clasica')`,
    [value],
  );
}

test("la dueña cierra un espacio y esas horas dejan de salir en el editor", async ({
  page,
}) => {
  const day = await emptyWorkday();
  await signIn(page, OWNER);
  await visit(page, `/pro/agenda?dia=${day}`);
  const grid = page.getByTestId("agenda-grilla");
  await expect(grid).toBeVisible();

  // Mantener presionado a las 10:00 abre el modo con ese cuadrito elegido; tocar el siguiente
  // alarga el rango.
  await holdQuarter(page, 4);
  const mode = page.getByRole("dialog", { name: "Bloquear espacios" });
  await expect(mode).toBeVisible();
  await expect(
    mode.getByRole("button", { name: "10:00 a. m.", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await mode.getByRole("button", { name: "10:15 a. m.", exact: true }).click();
  await expect(mode.getByText(/· 10:00 a 10:30 a\. m\./)).toBeVisible();
  await mode.getByRole("button", { name: "Bloquear 30 min" }).click();
  await expect(page.getByText("Espacio bloqueado")).toBeVisible();
  await expect(
    mode.getByRole("button", { name: /^Bloqueado de 10:00 a 10:30 a\. m\./ }),
  ).toBeVisible();
  await mode.getByRole("button", { name: "Listo" }).click();
  await expect(mode).toBeHidden();
  const block = grid.getByRole("button", {
    name: /^Bloqueado de 10:00 a 10:30 a\. m\./,
  });
  await expect(block).toBeVisible();

  // En el editor, esas horas ya no salen para Camilo.
  await visit(page, `/pro/agenda/nueva?dia=${day}`);
  await page.getByRole("searchbox", { name: "Buscar cliente" }).fill("mateo");
  await page.getByRole("button", { name: /Mateo Gómez/ }).click();
  await page.getByRole("button", { name: "Seleccionar Corte clásico" }).click();
  await page.getByRole("button", { name: "Camilo", exact: true }).click();
  const hours = page.getByRole("group", { name: "Horas libres" });
  await expect(
    hours.getByRole("button", { name: "9:30 a. m.", exact: true }),
  ).toBeVisible();
  await expect(
    hours.getByRole("button", { name: "10:00 a. m.", exact: true }),
  ).toHaveCount(0);
  await expect(
    hours.getByRole("button", { name: "10:30 a. m.", exact: true }),
  ).toBeVisible();

  // Tampoco le salen al cliente en la página del negocio (flujo 4 completo, Fase 5).
  const [{ business, service }] = await sql<{
    business: string;
    service: string;
  }>(
    `select b.id as business, sv.id as service from public.businesses b
     join public.services sv on sv.business_id = b.id and sv.name = 'Corte clásico'
     where b.slug = 'barberia-la-clasica'`,
  );
  await visit(
    page,
    `/app/negocio/${business}?servicio=${service}&profesional=${await camiloId()}&dia=${day}`,
  );
  const clientHours = page
    .getByRole("region", { name: "Reservar" })
    .getByRole("group", { name: "Horas libres" });
  await expect(
    clientHours.getByRole("button", { name: "9:30 a. m.", exact: true }),
  ).toBeVisible();
  await expect(
    clientHours.getByRole("button", { name: "10:00 a. m.", exact: true }),
  ).toHaveCount(0);
  await expect(
    clientHours.getByRole("button", { name: "10:30 a. m.", exact: true }),
  ).toBeVisible();

  // Tocar el bloqueo en la agenda ofrece quitarlo.
  await visit(page, `/pro/agenda?dia=${day}`);
  await agendaReady(page);
  await block.click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("¿Quitar este bloqueo?");
  await confirm.getByRole("button", { name: "Sí, quitar" }).click();
  await expect(page.getByText("Bloqueo quitado")).toBeVisible();
  await expect(block).toHaveCount(0);
});

test("si alguien agenda mientras se elige, el bloqueo no entra", async ({
  page,
}) => {
  const day = await emptyWorkday();
  await signIn(page, OWNER);
  await visit(page, `/pro/agenda?dia=${day}`);
  await holdQuarter(page, 8);
  const mode = page.getByRole("dialog", { name: "Bloquear espacios" });
  await expect(
    mode.getByRole("button", { name: "11:00 a. m.", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await takeSlot(day, "11:00");
  await mode.getByRole("button", { name: "Bloquear 15 min" }).click();
  await expect(page.getByText(OVERLAP)).toBeVisible();
});

test("sin el permiso de bloquear, el profesional ve el aviso y no bloquea clientes", async ({
  page,
}) => {
  await setManualBlock(false);
  try {
    await signIn(page, STAFF);
    await visit(page, `/pro/agenda?dia=${await emptyWorkday()}`);
    await expect(page.getByTestId("agenda-grilla")).toBeVisible();
    await holdQuarter(page, 12);
    await expect(page.getByText(NO_PERMISSION)).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Bloquear espacios" }),
    ).toHaveCount(0);

    // En una cita suya que reservó un cliente, no sale "Bloquear usuario" (es del dueño).
    const [{ id }] = await sql<{ id: string }>(
      `select b.id from public.bookings b join public.staff s on s.id = b.staff_id
       join public.profiles p on p.id = s.profile_id
       where p.phone = '+573005550111' and b.booked_by = 'client' and b.status = 'pending'
         and b.starts_at > now() + interval '1 day'
       order by b.starts_at limit 1`,
    );
    await visit(page, `/pro/agenda?cita=${id}`);
    await expect(page.getByRole("dialog")).toContainText("Cliente");
    await expect(
      page.getByRole("button", { name: "Bloquear usuario" }),
    ).toHaveCount(0);
  } finally {
    await setManualBlock(true);
  }
});

test("la dueña bloquea y desbloquea a un cliente desde su cita", async ({
  page,
}) => {
  const [booking] = await sql<{ id: string; name: string; client: string }>(
    `select b.id, c.full_name as name, c.id as client from public.bookings b
     join public.clients c on c.id = b.client_id
     join public.businesses bu on bu.id = b.business_id
     where bu.slug = 'barberia-la-clasica' and b.booked_by = 'client' and b.status = 'pending'
       and b.starts_at > now() + interval '1 day'
     order by b.starts_at limit 1`,
  );
  await signIn(page, OWNER);
  await visit(page, `/pro/agenda?cita=${booking.id}`);
  const detail = page.getByRole("dialog");
  await detail.getByRole("button", { name: "Bloquear usuario" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(`¿Bloquear a ${booking.name}?`);
  await expect(confirm).toContainText(
    "No podrá reservar en línea en tu negocio.",
  );
  await confirm.getByRole("button", { name: "Sí, bloquear" }).click();
  await expect(page.getByText(`Bloqueaste a ${booking.name}`)).toBeVisible();
  const [{ blocked }] = await sql<{ blocked: boolean }>(
    "select is_blocked as blocked from public.clients where id = $1",
    [booking.client],
  );
  expect(blocked).toBe(true);

  await detail.getByRole("button", { name: "Desbloquear usuario" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Sí, desbloquear" })
    .click();
  await expect(page.getByText(`Desbloqueaste a ${booking.name}`)).toBeVisible();
  await expect(
    detail.getByRole("button", { name: "Bloquear usuario" }),
  ).toBeVisible();
});

test("la dueña crea una serie con una fecha ocupada y cancela esa cita y las siguientes", async ({
  page,
}) => {
  const day = await emptyWorkday();
  const [{ second }] = await sql<{ second: string }>(
    "select to_char($1::date + 7, 'YYYY-MM-DD') as second",
    [day],
  );
  await takeSlot(second, "09:00");

  await signIn(page, OWNER);
  await visit(page, `/pro/agenda/nueva?dia=${day}`);
  await page.getByRole("searchbox", { name: "Buscar cliente" }).fill("mateo");
  await page.getByRole("button", { name: /Mateo Gómez/ }).click();
  await page.getByRole("button", { name: "Seleccionar Corte clásico" }).click();
  await page.getByRole("button", { name: "Camilo", exact: true }).click();
  await page
    .getByRole("group", { name: "Horas libres" })
    .getByRole("button", { name: "9:00 a. m.", exact: true })
    .click();

  await page.getByRole("switch", { name: "Repetir esta cita" }).click();
  const less = page.getByRole("button", { name: "Una cita menos" });
  for (let count = 10; count > 4; count--) await less.click();
  const dates = page.getByRole("list", { name: "Fechas de la serie" });
  await expect(dates.getByRole("listitem")).toHaveCount(4);
  await expect(dates.getByRole("listitem").nth(1)).toContainText(
    "hora ocupada",
  );
  await page.getByRole("button", { name: "Crear 3 de 4 citas" }).click();
  await expect(
    page.getByText("Se crearon 3 citas. 1 no, porque la hora estaba ocupada."),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/pro/agenda\\?dia=${day}$`));

  // Cancelar la primera pregunta si es solo esa o esa y las siguientes.
  const card = page
    .getByTestId("agenda-grilla")
    .getByRole("link", { name: /Mateo Gómez/ });
  await card.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar cita" })
    .click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Es parte de una serie");
  await confirm.getByRole("button", { name: "Esta y las siguientes" }).click();
  await expect(page.getByText("Se cancelaron 3 citas")).toBeVisible();
  await expect(card).toHaveCount(0);
  const [{ pending }] = await sql<{ pending: number }>(
    `select count(*)::int as pending from public.bookings b
     join public.recurring_bookings r on r.id = b.recurring_id
     where r.starts_on = $1 and b.status = 'pending'`,
    [day],
  );
  expect(pending).toBe(0);
});
