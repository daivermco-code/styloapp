// Fase 6, página por enlace (US-033): sin cuenta se elige servicio, profesional, día y hora en
// /n/<slug>; "Agendar cita" pide entrar, vuelve con todo puesto y sigue el camino de la Fase 5
// (revisar y éxito). Con las reservas en línea apagadas lo dice y no deja agendar, y un enlace que
// no existe tiene su mensaje.
import { expect, test } from "@playwright/test";
import { sql } from "../db/helpers";
import { readCodeFromInbox, requestCodeFor, typeCode, visit } from "./helpers";

const CLIENT = "3005550122"; // Daniela
const LINK = "/n/barberia-la-clasica";
const PICK_A_TIME = "Elige una hora para agendar.";
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

/** Un día sin domingo después de las citas sembradas (llegan hasta 21 días adelante). */
async function emptyWorkday(): Promise<string> {
  const [{ day }] = await sql<{ day: string }>(
    `select to_char(d, 'YYYY-MM-DD') as day
     from generate_series((now() at time zone 'America/Bogota')::date + 24,
                          (now() at time zone 'America/Bogota')::date + 31, interval '1 day') d
     where extract(dow from d) <> 0
     order by d limit 1`,
  );
  return day;
}

/** El nombre del día en la barra de días: "2026-11-24" → "Martes 24 de noviembre". */
function dayLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${date} de ${MONTHS[month - 1]}`;
}

test("sin cuenta elige todo, entra, vuelve con todo y agenda", async ({
  page,
}) => {
  test.slow();
  const day = await emptyWorkday();
  await visit(page, LINK);
  await expect(page.getByText("Bienvenido, reserva en")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Barbería La Clásica", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();

  await page.getByRole("button", { name: /Corte clásico/ }).click();
  const sheet = page.getByRole("region", { name: "Reservar" });
  const agendar = sheet.getByRole("button", { name: "Agendar cita" });
  await expect(agendar).toBeDisabled();
  await expect(sheet.getByText(PICK_A_TIME)).toBeVisible();

  await sheet.getByRole("button", { name: "Camilo", exact: true }).click();
  await sheet.getByRole("button", { name: dayLabel(day), exact: true }).click();
  const first = sheet
    .getByRole("group", { name: "Horas libres" })
    .getByRole("button")
    .first();
  await expect(first).toBeEnabled();
  const hour = (await first.textContent()) ?? "";
  await first.click();
  await expect(sheet.getByText(PICK_A_TIME)).toHaveCount(0);

  // Agendar pide entrar y vuelve al enlace con todo elegido.
  await agendar.click();
  await expect(page).toHaveURL(/\/entrar\?siguiente=/);
  await requestCodeFor(page, CLIENT);
  await typeCode(page, await readCodeFromInbox(page));
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page).toHaveURL(/\/n\/barberia-la-clasica\?servicio=.+&hora=/);
  await expect(
    sheet.getByRole("button", { name: hour, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Mis citas" })).toBeVisible();

  await sheet.getByRole("button", { name: "Agendar cita" }).click();
  const review = page.getByRole("dialog", { name: "Revisa tu reserva" });
  await expect(review).toContainText("Corte clásico");
  await expect(review).toContainText("Camilo");
  await expect(review).toContainText(hour);
  await review.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(
    page.getByRole("dialog", { name: "¡Listo, quedó reservada!" }),
  ).toContainText("Recuerda llegar 5 minutos antes.");
});

test("Cambiar quita el servicio elegido", async ({ page }) => {
  await visit(page, LINK);
  await page.getByRole("button", { name: /Corte clásico/ }).click();
  const sheet = page.getByRole("region", { name: "Reservar" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Cambiar" }).click();
  await expect(sheet).toHaveCount(0);
});

test("con las reservas en línea apagadas lo dice y no deja agendar", async ({
  page,
}) => {
  await sql(
    "update public.businesses set online_booking = false where slug = 'barberia-la-clasica'",
  );
  try {
    await visit(page, LINK);
    await expect(page.getByRole("note")).toHaveText(ONLINE_OFF);
    await expect(
      page.getByRole("button", { name: /Corte clásico/ }),
    ).toBeDisabled();
    await expect(page.getByRole("region", { name: "Reservar" })).toHaveCount(0);
  } finally {
    await sql(
      "update public.businesses set online_booking = true where slug = 'barberia-la-clasica'",
    );
  }
});

test("un enlace que no existe muestra su mensaje y vuelve al inicio", async ({
  page,
}) => {
  await visit(page, "/n/no-existe-este-negocio");
  await expect(
    page.getByText("Este enlace no es de ningún negocio de la demo."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ir al inicio" }).click();
  await expect(page).toHaveURL(/\/$/);
});
