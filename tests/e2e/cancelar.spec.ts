// Fase 6, cambiar y cancelar como cliente (US-029, flujo E2E 6): Mateo cambia la hora de una cita
// desde Mis Reservas y al profesional le llega el aviso; cancela una que está a menos de una hora
// (con el aviso de la reputación) y pasa a Historial; y en una que ya pasó el límite del negocio
// (15 minutos en la semilla) no salen los botones.
import { expect, type Page, test } from "@playwright/test";
import { sql } from "../db/helpers";
import { signIn, visit } from "./helpers";

const MATEO = "3005550121";
const TOO_LATE = "Ya no puedes cambiarla desde la app. Escríbele al negocio.";
const LATE_WARNING =
  "Cancelar tan cerca de la hora puede afectar tu reputación.";

test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

/**
 * Una cita de Mateo con Camilo que empieza en `minutes` minutos y dura 30 (lo que se cruce con ella
 * en la semilla se borra).
 */
async function bookingIn(minutes: number, service: string): Promise<void> {
  await sql(
    `delete from public.bookings b using public.clients c, public.services sv, public.profiles p
     where c.id = b.client_id and sv.id = b.service_id and p.id = c.profile_id
       and p.phone = '+573005550121' and sv.name = $1`,
    [service],
  );
  const from = `now() + interval '${minutes} minutes'`;
  const to = `now() + interval '${minutes + 30} minutes'`;
  for (const table of ["bookings", "agenda_blocks"]) {
    await sql(
      `delete from public.${table} k using public.staff s, public.profiles p
       where s.id = k.staff_id and p.id = s.profile_id and p.phone = '+573005550111'
         and k.starts_at < ${to} and k.ends_at > ${from}`,
    );
  }
  await sql(
    `insert into public.bookings
       (business_id, staff_id, service_id, client_id, booked_by, starts_at, ends_at, price)
     select s.business_id, s.id, sv.id, c.id, 'client', ${from}, ${to}, sv.price
     from public.staff s
     join public.profiles p on p.id = s.profile_id
     join public.services sv on sv.business_id = s.business_id and sv.name = $1
     join public.clients c on c.business_id = s.business_id
     join public.profiles cp on cp.id = c.profile_id and cp.phone = '+573005550121'
     where p.phone = '+573005550111'`,
    [service],
  );
}

/**
 * Una cita de Mateo con Camilo a las 10:00 del primer día (desde pasado mañana) en que él y el
 * negocio atienden de 10 a 12, con ese rato libre. Las demás citas que vienen de Mateo se borran
 * para que la fila sea la única con ese servicio.
 */
async function futureBooking(service: string): Promise<void> {
  await sql(
    `delete from public.bookings b using public.clients c, public.profiles p
     where c.id = b.client_id and p.id = c.profile_id and p.phone = '+573005550121'
       and b.starts_at > now()`,
  );
  const [{ starts }] = await sql<{ starts: string }>(
    `select ((d::date + time '10:00') at time zone 'America/Bogota')::text as starts
     from generate_series((now() at time zone 'America/Bogota')::date + 2,
                          (now() at time zone 'America/Bogota')::date + 9, interval '1 day') d
     where exists (
       select 1 from public.work_hours ws
       join public.staff s on s.id = ws.staff_id
       join public.profiles p on p.id = s.profile_id and p.phone = '+573005550111'
       join public.work_hours wb on wb.business_id = ws.business_id and wb.staff_id is null
                                and wb.weekday = ws.weekday
       where ws.weekday = extract(dow from d)
         and greatest(ws.starts, wb.starts) <= time '10:00'
         and least(ws.ends, wb.ends) >= time '12:00')
     order by d limit 1`,
  );
  const from = `'${starts}'::timestamptz`;
  for (const table of ["bookings", "agenda_blocks"]) {
    await sql(
      `delete from public.${table} k using public.staff s, public.profiles p
       where s.id = k.staff_id and p.id = s.profile_id and p.phone = '+573005550111'
         and k.starts_at < ${from} + interval '2 hours' and k.ends_at > ${from}`,
    );
  }
  await sql(
    `insert into public.bookings
       (business_id, staff_id, service_id, client_id, booked_by, starts_at, ends_at, price)
     select s.business_id, s.id, sv.id, c.id, 'client', ${from},
            ${from} + make_interval(mins => sv.duration_minutes), sv.price
     from public.staff s
     join public.profiles p on p.id = s.profile_id
     join public.services sv on sv.business_id = s.business_id and sv.name = $1
     join public.clients c on c.business_id = s.business_id
     join public.profiles cp on cp.id = c.profile_id and cp.phone = '+573005550121'
     where p.phone = '+573005550111'`,
    [service],
  );
}

/** La fila de una cita en la pestaña abierta de Mis Reservas, desplegada. */
async function openBooking(page: Page, service: string) {
  const row = page.getByRole("listitem").filter({ hasText: service });
  await row.getByRole("button", { expanded: false }).click();
  await expect(row.getByRole("button", { expanded: true })).toBeVisible();
  return row;
}

test("cambia la hora de su cita y al profesional le llega el aviso", async ({
  page,
}) => {
  await futureBooking("Corte clásico");
  await signIn(page, MATEO);
  await visit(page, "/app/reservas");
  const row = await openBooking(page, "Corte clásico");
  const before = await row
    .getByText(/ - \d{1,2}:\d{2} [ap]\. m\.$/)
    .textContent();
  await row.getByRole("button", { name: "Modificar cita" }).click();

  // La hoja abre con la cita cargada: su hora sale elegida y libre.
  const sheet = page.getByRole("dialog", { name: "Modificar cita" });
  const hours = sheet.getByRole("group", { name: "Horas libres" });
  await expect(hours.getByRole("button", { pressed: true })).toBeVisible();
  const other = hours.getByRole("button", { pressed: false }).first();
  const label = (await other.textContent()) ?? "";
  await other.click();
  await sheet.getByRole("button", { name: "Modificar cita" }).click();

  await expect(page.getByText("Listo, tu cita cambió")).toBeVisible();
  await expect(sheet).toBeHidden();
  await expect(row).toContainText(label);
  await expect(row).not.toContainText(before ?? "");
  const [notice] = await sql<{ title: string }>(
    `select title from public.demo_messages
     where recipient_phone = '+573005550111' and kind = 'booking_changed'
     order by created_at desc limit 1`,
  );
  expect(notice?.title).toBe("Cita cambiada");
});

test("cancela a menos de una hora con el aviso y la cita pasa a Historial", async ({
  page,
}) => {
  await bookingIn(45, "Afeitado clásico");
  await signIn(page, MATEO);
  await visit(page, "/app/reservas");
  const row = await openBooking(page, "Afeitado clásico");
  await row.getByRole("button", { name: "Cancelar cita" }).click();

  const confirm = page.getByRole("alertdialog", {
    name: "¿Seguro que quieres cancelar esta cita?",
  });
  await expect(confirm).toContainText(LATE_WARNING);
  await confirm.getByRole("button", { name: "Sí, cancelar" }).click();
  await expect(page.getByText("Cita cancelada")).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Afeitado clásico" }),
  ).toHaveCount(0);

  await page.getByRole("tab", { name: "Historial" }).click();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Afeitado clásico" })
      .getByText("Cancelada"),
  ).toBeVisible();
});

test("pasado el límite del negocio no salen los botones", async ({ page }) => {
  await bookingIn(10, "Línea o raya");
  await signIn(page, MATEO);
  await visit(page, "/app/reservas");
  const row = await openBooking(page, "Línea o raya");
  await expect(row.getByText(TOO_LATE)).toBeVisible();
  await expect(row.getByRole("button", { name: "Cancelar cita" })).toHaveCount(
    0,
  );
  await expect(row.getByRole("button", { name: "Modificar cita" })).toHaveCount(
    0,
  );
});
