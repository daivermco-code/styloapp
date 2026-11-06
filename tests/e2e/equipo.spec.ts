// Fase 2, equipo (US-012 a US-014): vincular a un profesional con el código, ponerle horario y
// servicios, desactivarlo; y el profesional ajustando lo suyo en su cuenta. Fase 7 (US-037 y
// US-038): precio y comisión por profesional, que cobra la cita nueva, y los permisos del equipo.
import { expect, test } from "@playwright/test";
import { sql } from "../db/helpers";
import { pickTime, signIn, visit } from "./helpers";

const OWNER = "3005550101"; // Valentina Ríos, Barbería La Clásica
const STAFF = "3005550111"; // Camilo Rojas, del mismo negocio
const FREE_STAFF = "3005550114"; // Laura Méndez, sin negocio
const CLIENT = "3005550121"; // Mateo Gómez
const NO_PERMISSION =
  "Tu negocio no te ha dado permiso para agendar. Pídeselo al dueño.";
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

// Cada proyecto (navegador y tamaño) empieza con la demo como nueva.
test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

/** Un día en que Camilo trabaja, después de las citas sembradas (llegan hasta 21 días adelante). */
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

/** El nombre del día en la barra de días: "2026-11-24" → "Martes 24 de noviembre". */
function dayLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${date} de ${MONTHS[month - 1]}`;
}

/** El negocio y Camilo, para ir derecho a su ficha y a la página del negocio. */
async function clasicaIds(): Promise<{ business: string; camilo: string }> {
  const [row] = await sql<{ business: string; camilo: string }>(
    `select b.id as business, s.id as camilo
     from public.businesses b
     join public.staff s on s.business_id = b.id
     join public.profiles p on p.id = s.profile_id
     where b.slug = 'barberia-la-clasica' and p.phone = '+573005550111'`,
  );
  return row;
}

test("vincular un profesional con el código, configurarlo y desactivarlo", async ({
  page,
}) => {
  const [{ code }] = await sql<{ code: string }>(
    `select c.code from public.business_link_codes c
     join public.businesses b on b.id = c.business_id
     where b.slug = 'barberia-la-clasica'`,
  );

  // Laura se vincula: primero con un código que no existe.
  await signIn(page, FREE_STAFF);
  await expect(page).toHaveURL(/\/pro\/vincularme$/);
  await expect(page.getByLabel("Tu nombre en la agenda")).toHaveValue("Laura");
  const codeField = page.getByLabel("Código del negocio");
  const link = page.getByRole("button", { name: "Vincularme" });
  await codeField.fill("zzzzzz");
  await expect(codeField).toHaveValue("ZZZZZZ");
  await link.click();
  await expect(
    page.getByText("No encontramos un negocio con ese código."),
  ).toBeVisible();
  await codeField.fill(code.toLowerCase());
  await link.click();
  await expect(page).toHaveURL(/\/pro$/, { timeout: 20_000 });
  await expect(
    page.getByText("Ya estás en el equipo de Barbería La Clásica."),
  ).toBeVisible();

  // La dueña la ve en Equipo, sin horario ni servicios.
  await page.context().clearCookies();
  await signIn(page, OWNER);
  await visit(page, "/pro/configurar/equipo");
  await expect(page.getByText("4 de 5 profesionales")).toBeVisible();
  const laura = page.getByRole("listitem").filter({ hasText: "Laura" });
  await expect(laura.getByText("Sin horario")).toBeVisible();
  await expect(laura.getByText("Sin servicios")).toBeVisible();
  await laura.getByRole("link").click();
  await expect(
    page.getByText(
      "Laura todavía no sale para reservar: le falta horario y servicios.",
    ),
  ).toBeVisible();

  // Horario: arranca con el del negocio y no se puede salir de él.
  const monday = page.getByRole("group", { name: "Lunes" });
  await monday.getByRole("switch", { name: "Lunes: abierto" }).click();
  await expect(
    page.getByRole("combobox", { name: "Lunes, franja 1: desde" }),
  ).toHaveText("9:00 a. m.");
  const save = page.getByRole("button", { name: "Guardar", exact: true });
  await pickTime(page, "Lunes, franja 1: desde", "8:00 a. m.");
  await expect(
    monday.getByText("Esta franja queda fuera del horario del negocio."),
  ).toBeVisible();
  await expect(save).toBeDisabled();
  await pickTime(page, "Lunes, franja 1: desde", "10:00 a. m.");
  await save.click();
  await expect(page.getByText("Horario guardado")).toBeVisible();
  await expect(save).toBeDisabled();

  // Servicios, con su propia duración.
  await page
    .getByRole("navigation", { name: "Configuración de Laura" })
    .getByRole("link", { name: "Servicios" })
    .click();
  await expect(page).toHaveURL(/pestana=servicios/);
  const haircut = page.getByRole("checkbox", { name: /^Corte clásico/ });
  await haircut.click();
  const duration = page.getByLabel(
    "Duración de Corte clásico con este profesional, en minutos",
  );
  await duration.fill("35");
  const saveServices = page.getByRole("button", { name: "Guardar servicios" });
  await saveServices.click();
  await expect(page.getByText("Servicios guardados")).toBeVisible();
  await expect(saveServices).toBeDisabled();
  await expect(page.getByText(/todavía no sale para reservar/)).toBeHidden();
  await page.reload();
  await expect(haircut).toBeChecked();
  await expect(duration).toHaveValue("35");

  // Ya está lista; la dueña la desactiva.
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL(/\/pro\/configurar\/equipo$/);
  await expect(laura.getByText("Sin horario")).toBeHidden();
  await expect(laura.getByText("Sin servicios")).toBeHidden();
  await laura.getByRole("button", { name: "Desactivar a Laura" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "¿Desactivar a Laura?",
  });
  await dialog.getByRole("button", { name: "Desactivar" }).click();
  await expect(page.getByText("Desactivaste a Laura.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Desactivados" }),
  ).toBeVisible();
  await expect(page.getByText("3 de 5 profesionales")).toBeVisible();
});

test("el profesional ajusta su horario y sus servicios en su cuenta", async ({
  page,
}) => {
  await signIn(page, STAFF);
  // En computador el menú lateral también la tiene.
  await page.getByRole("link", { name: "Configurar cuenta" }).first().click();
  await expect(page).toHaveURL(/\/pro\/configurar\/cuenta$/);
  const tabs = page.getByRole("navigation", { name: "Tu cuenta" });
  await expect(tabs.getByRole("link")).toHaveCount(2);
  await expect(page.getByText("Precio y comisión")).toHaveCount(0);

  // El negocio cierra a las 7:00 p. m.
  const save = page.getByRole("button", { name: "Guardar", exact: true });
  await pickTime(page, "Lunes, franja 1: hasta", "8:00 p. m.");
  await expect(
    page.getByText("Tu horario debe quedar dentro del horario del negocio."),
  ).toBeVisible();
  await expect(save).toBeDisabled();
  await pickTime(page, "Lunes, franja 1: hasta", "5:00 p. m.");
  await save.click();
  await expect(page.getByText("Horario guardado")).toBeVisible();
  await expect(save).toBeDisabled();

  await tabs.getByRole("link", { name: "Servicios" }).click();
  await expect(page).toHaveURL(/pestana=servicios/);
  const shave = page.getByRole("checkbox", { name: /^Rapado/ });
  await expect(shave).toBeChecked();
  await shave.click();
  const fade = page.getByLabel(
    "Duración de Corte fade con este profesional, en minutos",
  );
  await fade.fill("50");
  const saveServices = page.getByRole("button", { name: "Guardar servicios" });
  await saveServices.click();
  await expect(page.getByText("Servicios guardados")).toBeVisible();
  await expect(saveServices).toBeDisabled();
  await page.reload();
  await expect(shave).not.toBeChecked();
  await expect(fade).toHaveValue("50");

  // No entra a configurar a otros profesionales.
  await visit(page, "/pro/configurar/equipo");
  await expect(page).toHaveURL(/\/pro$/);
});

test("la dueña pone precio y comisión a un profesional y la cita nueva cobra ese precio", async ({
  page,
}) => {
  // Entran la dueña y el cliente: en WebKit no alcanza el minuto.
  test.slow();
  const { business, camilo } = await clasicaIds();
  await signIn(page, OWNER);
  await visit(page, `/pro/configurar/equipo/${camilo}?pestana=precio`);
  await expect(
    page.getByRole("heading", { name: "Precio y comisión" }),
  ).toBeVisible();
  const price = page.getByLabel("Precio de Corte clásico con Camilo, en pesos");
  const commission = page.getByLabel(
    "Comisión de Camilo en Corte clásico, en porcentaje",
  );
  // Vacío cobra el general (sale en gris) y la comisión empieza en 50 %.
  await expect(price).toHaveValue("");
  await expect(commission).toHaveValue("50");
  const save = page.getByRole("button", { name: "Guardar", exact: true });
  await price.fill("33000");
  await commission.fill("150");
  await expect(
    page.getByText(
      "Corte clásico: La comisión va de 0 a 100 %, con hasta dos decimales.",
    ),
  ).toBeVisible();
  await expect(save).toBeDisabled();
  await commission.fill("45,5");
  await save.click();
  await expect(page.getByText("Precio y comisión guardados")).toBeVisible();
  await expect(save).toBeDisabled();
  await page.reload();
  await expect(price).toHaveValue("33000");
  await expect(commission).toHaveValue("45,5");

  // Mateo reserva Corte clásico con Camilo: la revisión y la cita llevan el precio de Camilo.
  await page.context().clearCookies();
  await signIn(page, CLIENT);
  const day = await emptyWorkday();
  await visit(page, `/app/negocio/${business}`);
  await page.getByRole("button", { name: "Agendar Corte clásico" }).click();
  const sheet = page.getByRole("region", { name: "Reservar" });
  await sheet.getByRole("button", { name: "Camilo", exact: true }).click();
  await sheet.getByRole("button", { name: dayLabel(day), exact: true }).click();
  const first = sheet
    .getByRole("group", { name: "Horas libres" })
    .getByRole("button")
    .first();
  await expect(first).toBeEnabled();
  await first.click();
  await sheet.getByRole("button", { name: "Reservar", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Revisa tu reserva" });
  await expect(review).toContainText("$ 33.000");
  await review.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(
    page.getByRole("dialog", { name: "¡Listo, quedó reservada!" }),
  ).toBeVisible();
  const [booking] = await sql<{ price: number }>(
    `select b.price from public.bookings b
     join public.clients c on c.id = b.client_id
     join public.profiles p on p.id = c.profile_id
     where p.phone = '+573005550121' and b.staff_id = $1
       and (b.starts_at at time zone 'America/Bogota')::date = $2::date`,
    [camilo, day],
  );
  expect(booking.price).toBe(33000);
});

test("la dueña apaga agendar en Permisos y el profesional ya no puede, sin volver a entrar", async ({
  page,
  browser,
}) => {
  test.slow();
  // Camilo tiene su sesión abierta desde antes del cambio.
  const staff = await (await browser.newContext()).newPage();
  await signIn(staff, STAFF);
  // No entra a los permisos: vuelve a su inicio.
  await visit(staff, "/pro/configurar/permisos");
  await expect(staff).toHaveURL(/\/pro$/);

  await signIn(page, OWNER);
  await visit(page, "/pro/configurar/equipo");
  await page.getByRole("link", { name: /Permisos del equipo/ }).click();
  await expect(page).toHaveURL(/\/pro\/configurar\/permisos$/);
  // Vienen cuatro encendidos y el celular de los clientes apagado.
  const booking = page.getByRole("switch", { name: /^Agendar citas/ });
  await expect(booking).toBeChecked();
  await expect(
    page.getByRole("switch", { name: /^Ver el celular de los clientes/ }),
  ).not.toBeChecked();
  await booking.click();
  await expect(page.getByText("Agendar citas: apagado")).toBeVisible();
  await expect(booking).not.toBeChecked();
  await page.reload();
  await expect(booking).not.toBeChecked();

  // Camilo, sin volver a entrar: el + de su agenda avisa.
  await visit(staff, `/pro/agenda?dia=${await emptyWorkday()}`);
  await staff.getByRole("button", { name: "Agendar una cita" }).click();
  await expect(staff.getByText(NO_PERMISSION)).toBeVisible();

  // Se vuelve a encender.
  await booking.click();
  await expect(page.getByText("Agendar citas: encendido")).toBeVisible();
  await expect(booking).toBeChecked();
});
