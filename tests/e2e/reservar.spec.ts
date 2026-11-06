// Fase 5, reservar como cliente (US-024 a US-028, flujo E2E 2): sin cuenta se explora y se abre
// un negocio; Reservar lleva a entrar y vuelve con todo elegido; la cita sale en la agenda de la
// dueña y del profesional sin recargar y en Mis Reservas. También la hora que otro toma durante
// la verificación y el negocio con las reservas en línea apagadas.
import { type Browser, expect, type Page, test } from "@playwright/test";
import { sql } from "../db/helpers";
import {
  readCodeFromInbox,
  requestCodeFor,
  signIn,
  typeCode,
  visit,
} from "./helpers";

const OWNER = "3005550101"; // Valentina Ríos, Barbería La Clásica
const STAFF = "3005550111"; // Camilo Rojas, del mismo negocio
const CLIENT = "3005550121"; // Mateo Gómez
const SLOT_TAKEN = "Esa hora se acaba de ocupar. Elige otra.";
const ONLINE_OFF =
  "Este negocio no está recibiendo reservas en línea por ahora.";

const WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

/** Un día en que Camilo trabaja, después de las citas sembradas (llegan hasta 21 días adelante). */
async function emptyWorkday(offset = 23): Promise<string> {
  const [{ day }] = await sql<{ day: string }>(
    `select to_char(d, 'YYYY-MM-DD') as day
     from generate_series((now() at time zone 'America/Bogota')::date + $1::int,
                          (now() at time zone 'America/Bogota')::date + $1::int + 7,
                          interval '1 day') d
     where extract(dow from d) <> 0
     order by d limit 1`,
    [offset],
  );
  return day;
}

/** El nombre del día en la barra de días: "2026-11-24" → "Martes 24 de noviembre". */
function dayLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${date} de ${MONTHS[month - 1]}`;
}

async function businessUrl(): Promise<string> {
  const [{ id }] = await sql<{ id: string }>(
    "select id from public.businesses where slug = 'barberia-la-clasica'",
  );
  return `/app/negocio/${id}`;
}

/** Otra persona abre la agenda de ese día (en su propio navegador) y la deja abierta. */
async function openAgenda(
  browser: Browser,
  phone: string,
  day: string,
): Promise<Page> {
  const other = await (await browser.newContext()).newPage();
  await signIn(other, phone);
  await visit(other, `/pro/agenda?dia=${day}`);
  await expect(other.getByTestId("agenda-grilla")).toBeVisible();
  return other;
}

/** Agendar Corte clásico con Camilo ese día; devuelve la primera hora libre, ya elegida. */
async function chooseFirstHour(page: Page, day: string): Promise<string> {
  await page.getByRole("button", { name: "Agendar Corte clásico" }).click();
  const sheet = page.getByRole("region", { name: "Reservar" });
  await sheet.getByRole("button", { name: "Camilo", exact: true }).click();
  await sheet.getByRole("button", { name: dayLabel(day), exact: true }).click();
  const first = sheet
    .getByRole("group", { name: "Horas libres" })
    .getByRole("button")
    .first();
  await expect(first).toBeEnabled();
  const label = (await first.textContent()) ?? "";
  await first.click();
  return label;
}

test("sin cuenta reserva, entra, vuelve con todo y la cita llega a las dos agendas", async ({
  page,
  browser,
}) => {
  // Entran tres personas (dueña, profesional y cliente): en WebKit no alcanza el minuto.
  test.slow();
  const day = await emptyWorkday();
  const owner = await openAgenda(browser, OWNER, day);
  const staff = await openAgenda(browser, STAFF, day);

  // Sin cuenta: el Inicio con "Cerca de ti" y la página del negocio.
  await visit(page, "/app");
  await expect(
    page.getByRole("heading", { name: "Cerca de ti" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /Barbería La Clásica/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Barbería La Clásica" }),
  ).toBeVisible();
  const hour = await chooseFirstHour(page, day);

  // Reservar pide entrar y vuelve a la página con todo elegido.
  await page.getByRole("button", { name: "Reservar", exact: true }).click();
  await expect(page).toHaveURL(/\/entrar\?siguiente=/);
  await requestCodeFor(page, CLIENT);
  await typeCode(page, await readCodeFromInbox(page));
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/negocio\/.+servicio=.+&hora=/);
  const sheet = page.getByRole("region", { name: "Reservar" });
  await expect(
    sheet.getByRole("button", { name: hour, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  // Revisa tu reserva y la pantalla de éxito.
  await sheet.getByRole("button", { name: "Reservar", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Revisa tu reserva" });
  await expect(review).toContainText("Corte clásico");
  await expect(review).toContainText("Camilo");
  await expect(review).toContainText(hour);
  await expect(review.getByRole("checkbox")).not.toBeChecked();
  await review.getByRole("button", { name: "Confirmar reserva" }).click();
  const success = page.getByRole("dialog", {
    name: "¡Listo, quedó reservada!",
  });
  await expect(success).toContainText("Recuerda llegar 5 minutos antes.");

  // En máximo 3 segundos sale en la agenda de la dueña y del profesional, sin recargar.
  for (const agenda of [owner, staff]) {
    await expect(
      agenda
        .getByTestId("agenda-grilla")
        .getByRole("link", { name: /Mateo Gómez/ }),
    ).toBeVisible({ timeout: 3_000 });
  }

  // Cerrar lleva a Mis Reservas, con la cita en Actuales.
  await success.getByRole("button", { name: "Cerrar" }).first().click();
  await expect(page).toHaveURL(/\/app\/reservas$/);
  // La cita nueva es la más lejana: las de la semilla llegan hasta 21 días adelante.
  const booked = page
    .getByRole("tabpanel", { name: "Actuales" })
    .getByRole("listitem")
    .last();
  await expect(booked).toContainText("Corte clásico");
  await booked.getByRole("button").click();
  await expect(booked).toContainText("Camilo");
  await expect(booked).toContainText(hour);
  await expect(booked).toContainText("Barbería La Clásica");

  // La bandeja: Camilo tiene su aviso, y la confirmación del cliente abre la cita desplegada.
  await staff.getByRole("button", { name: /^Bandeja de la demo/ }).click();
  await expect(
    staff.getByRole("dialog", { name: "Bandeja de la demo" }),
  ).toContainText("Te agendaron Corte clásico con Mateo Gómez");
  await page.getByRole("button", { name: /^Bandeja de la demo/ }).click();
  await page
    .getByRole("dialog", { name: "Bandeja de la demo" })
    .getByRole("link", { name: /Cita confirmada/ })
    .filter({ hasText: "con Camilo" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app\/reservas\?cita=/);
  const opened = page
    .getByRole("tabpanel", { name: "Actuales" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { expanded: true }) });
  await expect(opened).toHaveCount(1);
  await expect(opened).toContainText(hour);
});

test("si otro toma la hora durante la verificación, avisa y la quita de la fila", async ({
  page,
}) => {
  const day = await emptyWorkday(24);
  await signIn(page, CLIENT);
  await visit(page, await businessUrl());
  const hour = await chooseFirstHour(page, day);
  const sheet = page.getByRole("region", { name: "Reservar" });
  await sheet.getByRole("button", { name: "Reservar", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Revisa tu reserva" });
  await expect(review).toBeVisible();

  const [, h, m, half] = hour.match(/(\d{1,2}):(\d{2}) ([ap])\. m\./) ?? [];
  const clock = `${String((Number(h) % 12) + (half === "p" ? 12 : 0)).padStart(2, "0")}:${m}`;
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
  await review.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(page.getByText(SLOT_TAKEN)).toBeVisible();
  await expect(review).toBeHidden();
  await expect(
    sheet
      .getByRole("group", { name: "Horas libres" })
      .getByRole("button", { name: hour, exact: true }),
  ).toHaveCount(0);
});

test("con las reservas en línea apagadas, avisa y Agendar no abre la hoja", async ({
  page,
}) => {
  await sql(
    "update public.businesses set online_booking = false where slug = 'barberia-la-clasica'",
  );
  try {
    await visit(page, await businessUrl());
    await expect(page.getByRole("note")).toHaveText(ONLINE_OFF);
    await page.getByRole("button", { name: "Agendar Corte clásico" }).click();
    await expect(page.getByText(ONLINE_OFF).nth(1)).toBeVisible();
    await expect(page.getByRole("region", { name: "Reservar" })).toHaveCount(0);
  } finally {
    await sql(
      "update public.businesses set online_booking = true where slug = 'barberia-la-clasica'",
    );
  }
});
