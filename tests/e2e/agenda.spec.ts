// Fase 3, agenda (US-015 a US-019): la dueña crea, modifica y cancela una cita desde la agenda,
// con la hora que otro toma mientras ella elige; y el profesional sin el permiso de agendar ve
// el aviso (flujo E2E 3).
import { expect, test } from "@playwright/test";
import { sql } from "../db/helpers";
import { signIn, visit } from "./helpers";

const OWNER = "3005550101"; // Valentina Ríos, Barbería La Clásica
const STAFF = "3005550111"; // Camilo Rojas, del mismo negocio
const SLOT_TAKEN = "Alguien acaba de tomar esa hora. Elige otra.";
const NO_PERMISSION =
  "Tu negocio no te ha dado permiso para agendar. Pídeselo al dueño.";

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

/** "9:30 a. m." → "09:30". */
function toClock(label: string): string {
  const [, hours, minutes, half] =
    label.match(/(\d{1,2}):(\d{2}) ([ap])\. m\./) ?? [];
  if (!hours) throw new Error(`Hora sin formato: ${label}`);
  const h = (Number(hours) % 12) + (half === "p" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${minutes}`;
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

async function setManualBooking(value: boolean): Promise<void> {
  await sql(
    `update public.team_permissions set manual_booking = $1
     where business_id = (select id from public.businesses where slug = 'barberia-la-clasica')`,
    [value],
  );
}

test("la dueña crea, modifica y cancela una cita desde la agenda", async ({
  page,
}) => {
  const day = await emptyWorkday();
  await signIn(page, OWNER);
  await visit(page, `/pro/agenda?dia=${day}`);
  const grid = page.getByTestId("agenda-grilla");
  await expect(grid).toBeVisible();
  await expect(grid.getByRole("link")).toHaveCount(0);
  await page.getByRole("link", { name: "Agendar una cita" }).click();
  await expect(page).toHaveURL(new RegExp(`/pro/agenda/nueva\\?dia=${day}`));

  // Cliente, servicio y profesional.
  await page.getByRole("searchbox", { name: "Buscar cliente" }).fill("mateo");
  await page.getByRole("button", { name: /Mateo Gómez/ }).click();
  await page.getByRole("button", { name: "Seleccionar Corte clásico" }).click();
  await page.getByRole("button", { name: "Camilo", exact: true }).click();
  const hours = page.getByRole("group", { name: "Horas libres" });
  const first = hours.getByRole("button").first();
  await expect(first).toBeEnabled();
  const takenLabel = (await first.textContent()) ?? "";

  // Mientras la dueña elige, alguien toma esa hora: avisa y la quita de la fila.
  await first.click();
  await takeSlot(day, toClock(takenLabel));
  await page.getByRole("button", { name: "Crear cita" }).click();
  await expect(page.getByText(SLOT_TAKEN)).toBeVisible();
  await expect(
    hours.getByRole("button", { name: takenLabel, exact: true }),
  ).toHaveCount(0);

  // Con otra hora queda agendada y sale en la agenda.
  const chosen = hours.getByRole("button").nth(1);
  const chosenLabel = (await chosen.textContent()) ?? "";
  await chosen.click();
  await page.getByRole("button", { name: "Crear cita" }).click();
  await expect(page).toHaveURL(new RegExp(`/pro/agenda\\?dia=${day}$`));
  await expect(page.getByText("Cita agendada")).toBeVisible();
  const card = grid.getByRole("link", { name: /Mateo Gómez/ });
  await expect(card).toContainText(chosenLabel.replace(/ [ap]\. m\./, ""));

  // El detalle: la reservó el negocio y se puede modificar.
  await card.click();
  const detail = page.getByRole("dialog");
  await expect(detail.getByText("Cita con:")).toContainText("Mateo Gómez");
  await expect(detail.getByText("Negocio", { exact: true })).toBeVisible();
  await detail.getByRole("link", { name: "Modificar cita" }).click();
  await expect(page).toHaveURL(/\/pro\/agenda\/nueva\?modificar=/);
  const later = hours.getByRole("button").nth(4);
  await expect(later).toBeEnabled();
  const laterLabel = (await later.textContent()) ?? "";
  await later.click();
  await page.getByRole("button", { name: "Modificar cita" }).click();
  await expect(page).toHaveURL(new RegExp(`/pro/agenda\\?dia=${day}$`));
  await expect(page.getByText("Cita modificada")).toBeVisible();
  await expect(card).toContainText(laterLabel.replace(/ [ap]\. m\./, ""));

  // Cancelar pide confirmación y la cita sale de la agenda.
  await card.click();
  await detail.getByRole("button", { name: "Cancelar cita" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("¿Cancelar esta cita?");
  await confirm.getByRole("button", { name: "Sí, cancelar" }).click();
  await expect(page.getByText("Cita cancelada")).toBeVisible();
  await expect(card).toHaveCount(0);
});

test("sin el permiso de agendar, el profesional ve el aviso", async ({
  page,
}) => {
  await setManualBooking(false);
  try {
    await signIn(page, STAFF);
    await visit(page, `/pro/agenda?dia=${await emptyWorkday()}`);
    const grid = page.getByTestId("agenda-grilla");
    await expect(grid.getByText("Camilo")).toBeVisible();
    await expect(grid.getByText("Julián")).toHaveCount(0);
    await page.getByRole("button", { name: "Agendar una cita" }).click();
    await expect(page.getByText(NO_PERMISSION)).toBeVisible();

    // Tampoco entra al editor por la dirección.
    await visit(page, "/pro/agenda/nueva");
    await expect(page.getByText(NO_PERMISSION)).toBeVisible();
  } finally {
    await setManualBooking(true);
  }
});
