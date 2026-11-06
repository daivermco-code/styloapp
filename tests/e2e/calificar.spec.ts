// Fase 5, calificar (US-019, US-030 y US-031, flujo E2E 5): el profesional marca que el cliente
// llegó y, sin recargar, el Inicio del cliente pide calificar; al enviar, la calificación del
// profesional cambia en su inicio sin recargar y la reseña sale en Mis reseñas; la llegada sale
// en Mi reputación. También "Calificar más tarde" y calificar desde Historial.
import { expect, type Page, test } from "@playwright/test";
import { sql } from "../db/helpers";
import { signIn, visit } from "./helpers";

const STAFF = "3005550111"; // Camilo Rojas, Barbería La Clásica
const MATEO = "3005550121";
const DANIELA = "3005550122"; // tiene una cita efectiva sin calificar en la semilla
const STARS_MISSING = "Pon las estrellas para poder enviar.";

test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

/**
 * Una cita de Mateo con Camilo que empezó hace 20 minutos, todavía sin marcar (lo que se cruce
 * con ella en la semilla se borra).
 */
async function startedBooking(): Promise<string> {
  const span = `now() - interval '20 minutes', now() + interval '10 minutes'`;
  await sql(
    `delete from public.bookings b using public.staff s, public.profiles p
     where s.id = b.staff_id and p.id = s.profile_id and p.phone = '+573005550111'
       and b.starts_at < now() + interval '10 minutes' and b.ends_at > now() - interval '20 minutes'`,
  );
  await sql(
    `delete from public.agenda_blocks k using public.staff s, public.profiles p
     where s.id = k.staff_id and p.id = s.profile_id and p.phone = '+573005550111'
       and k.starts_at < now() + interval '10 minutes' and k.ends_at > now() - interval '20 minutes'`,
  );
  const [{ id }] = await sql<{ id: string }>(
    `insert into public.bookings
       (business_id, staff_id, service_id, client_id, booked_by, starts_at, ends_at, price)
     select s.business_id, s.id, sv.id, c.id, 'client', ${span}, sv.price
     from public.staff s
     join public.profiles p on p.id = s.profile_id
     join public.services sv on sv.business_id = s.business_id and sv.name = 'Corte clásico'
     join public.clients c on c.business_id = s.business_id
     join public.profiles cp on cp.id = c.profile_id and cp.phone = '+573005550121'
     where p.phone = '+573005550111'
     returning id`,
  );
  return id;
}

/** Las reseñas que muestra el inicio del profesional: "(57) reseñas" → 57. */
async function reviewCount(page: Page): Promise<number> {
  const label = page.getByText(/^\(\d+\) reseñas$/);
  await expect(label).toBeVisible();
  return Number((await label.textContent())?.match(/\d+/)?.[0]);
}

async function rate(page: Page): Promise<void> {
  const send = page.getByRole("button", { name: "Enviar", exact: true });
  await expect(send).toBeDisabled();
  await expect(page.getByText(STARS_MISSING)).toBeVisible();
  await page
    .getByRole("radiogroup", { name: "Atención y trato" })
    .getByRole("radio", { name: "5 estrellas" })
    .click();
  await expect(send).toBeDisabled();
  await page
    .getByRole("radiogroup", { name: "Resultado del servicio" })
    .getByRole("radio", { name: "4 estrellas" })
    .click();
  await page
    .getByLabel("Escribe tus comentarios (opcional)")
    .fill("Me atendieron puntual.");
  await send.click();
  await expect(
    page.getByText("¡Gracias por contarnos cómo te fue!"),
  ).toBeVisible();
}

test("llega, lo marcan, califica y cambia la calificación del profesional", async ({
  page,
  browser,
}) => {
  const bookingId = await startedBooking();
  const staff = await (await browser.newContext()).newPage();
  await signIn(staff, STAFF);
  await signIn(page, MATEO);
  await expect(page.getByRole("main").getByText("Mateo Gómez")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Hola de nuevo/ }),
  ).toHaveCount(0);

  // Camilo marca que llegó a tiempo: el Inicio de Mateo pide calificar sin recargar.
  await visit(staff, `/pro/agenda?cita=${bookingId}`);
  await staff
    .getByRole("dialog")
    .getByRole("button", { name: "A tiempo" })
    .click();
  await expect(
    page.getByRole("heading", { name: "¡Hola de nuevo, Mateo Gómez!" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText(
    "Corte clásico con Camilo",
  );
  // La invitación de la bandeja lleva a calificar esa cita.
  await page.getByRole("button", { name: /^Bandeja de la demo/ }).click();
  const inbox = page.getByRole("dialog", { name: "Bandeja de la demo" });
  await expect(
    inbox.getByRole("link", { name: /¿Cómo te fue\?/ }).first(),
  ).toHaveAttribute("href", `/app/calificar/${bookingId}`);
  await page.keyboard.press("Escape");
  await expect(inbox).toBeHidden();

  // Con el inicio de Camilo abierto, Mateo califica.
  await visit(staff, "/pro");
  const before = await reviewCount(staff);
  await rate(page);
  await expect(
    page.getByRole("heading", { name: "Tus servicios recientes" }),
  ).toBeVisible();
  await expect(staff.getByText(`(${before + 1}) reseñas`)).toBeVisible({
    timeout: 3_000,
  });

  // La reseña en Mis reseñas y la llegada en Mi reputación.
  await visit(page, "/app/resenas");
  const reviews = page.getByRole("list", { name: "Mis reseñas" });
  await expect(reviews.getByRole("listitem").first()).toContainText(
    "Servicio: Corte clásico con Camilo",
  );
  await expect(reviews.getByRole("listitem").first()).toContainText(
    "Me atendieron puntual.",
  );
  await visit(page, "/app/reputacion");
  await expect(
    page.getByRole("heading", { name: "Tienes una excelente reputación" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Citas marcadas" })
      .getByRole("listitem")
      .first(),
  ).toContainText("Llegó a tiempo");
});

test("calificar más tarde y luego desde Historial", async ({ page }) => {
  await signIn(page, DANIELA);
  const greeting = page.getByRole("heading", {
    name: "¡Hola de nuevo, Daniela Ruiz!",
  });
  await expect(greeting).toBeVisible();

  // "Calificar más tarde" vuelve al Inicio de siempre y se recuerda al recargar.
  await page.getByRole("button", { name: "Calificar más tarde" }).click();
  await expect(greeting).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Cerca de ti" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Cerca de ti" }),
  ).toBeVisible();
  await expect(greeting).toHaveCount(0);

  // En Historial, la cita trae "Califica tu experiencia".
  await visit(page, "/app/reservas?pestana=historial");
  const history = page.getByRole("tabpanel", { name: "Historial" });
  // Se despliegan las efectivas, de la más nueva a la más vieja, hasta dar con la que falta.
  const effective = history
    .getByRole("listitem")
    .filter({ hasText: "Efectiva" });
  const rateLink = history.getByRole("link", {
    name: "Califica tu experiencia",
  });
  await expect(effective.first()).toBeVisible();
  for (let index = 0; (await rateLink.count()) === 0; index++) {
    await effective.nth(index).getByRole("button").first().click();
  }
  await expect(rateLink).toHaveCount(1);
  await rateLink.click();
  await expect(page).toHaveURL(/\/app\/calificar\//);
  await rate(page);
  await expect(page).toHaveURL(/\/app$/);

  // Ya calificada: Historial no la ofrece y la página lo dice.
  await visit(page, "/app/reservas?pestana=historial");
  await expect(
    page.getByRole("link", { name: "Califica tu experiencia" }),
  ).toHaveCount(0);
});
