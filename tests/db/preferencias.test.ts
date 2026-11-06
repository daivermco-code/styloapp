// Pruebas de la Fase 6 contra el Supabase local (T-6.3.2, US-032): los interruptores del perfil
// cambian al momento lo que ve el negocio y lo que llega a la bandeja. Con "Compartir mi celular
// al reservar" apagado, la dueña no ve el celular de la ficha; con los mensajes de las citas por
// WhatsApp apagados, la confirmación no llega. Necesitan `npm run db:start` y `.env.local`.
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PreferenceKey } from "@/features/booking/types/profile";
import { type Db, resetDemo, signIn, sql } from "./helpers";

const MATEO = "+573005550121";
const OWNER = "+573005550101"; // Valentina Ríos, Barbería La Clásica

let mateo: Db;
let mateoId: string;
let owner: Db;
let clientId: string;

async function setPreference(key: PreferenceKey, value: boolean) {
  const { error } = await mateo
    .from("profiles")
    .update({ [key]: value } as Partial<Record<PreferenceKey, boolean>>)
    .eq("id", mateoId);
  expect(error).toBeNull();
}

/** Una cita de Mateo con Camilo dentro de 20 días a las 10:00, como la crea el negocio. */
async function newBooking(): Promise<string> {
  const from = `((now() at time zone 'America/Bogota')::date + 20 + time '10:00') at time zone 'America/Bogota'`;
  await sql(
    `delete from public.bookings b using public.staff s, public.profiles p
     where s.id = b.staff_id and p.id = s.profile_id and p.phone = '+573005550111'
       and b.starts_at < ${from} + interval '30 minutes' and b.ends_at > ${from}`,
  );
  const [{ id }] = await sql<{ id: string }>(
    `insert into public.bookings
       (business_id, staff_id, service_id, client_id, booked_by, starts_at, ends_at, price)
     select s.business_id, s.id, sv.id, $1, 'owner', ${from},
            ${from} + interval '30 minutes', sv.price
     from public.staff s
     join public.profiles p on p.id = s.profile_id
     join public.services sv on sv.business_id = s.business_id and sv.name = 'Corte clásico'
     where p.phone = '+573005550111'
     returning id`,
    [clientId],
  );
  return id;
}

async function confirmations(bookingId: string): Promise<number> {
  const [{ count }] = await sql<{ count: string }>(
    `select count(*) from public.demo_messages
     where booking_id = $1 and recipient_phone = $2 and channel = 'whatsapp'
       and kind = 'booking_confirmed'`,
    [bookingId, MATEO],
  );
  return Number(count);
}

beforeAll(async () => {
  await resetDemo();
  const signedMateo = await signIn(MATEO);
  mateo = signedMateo.client;
  mateoId = signedMateo.user.id;
  owner = (await signIn(OWNER)).client;
  const [row] = await sql<{ id: string }>(
    `select c.id from public.clients c join public.businesses b on b.id = c.business_id
     where b.slug = 'barberia-la-clasica' and c.profile_id = $1`,
    [mateoId],
  );
  clientId = row.id;
});

afterEach(async () => {
  await setPreference("share_phone_on_booking", true);
  await setPreference("whatsapp_booking_messages", true);
});

describe("interruptores del perfil", () => {
  it("con el celular sin compartir, la dueña no lo ve en la ficha", async () => {
    const before = await owner.rpc("client_phone", { p_client: clientId });
    expect(before.data).toBe(MATEO);

    await setPreference("share_phone_on_booking", false);
    const hidden = await owner.rpc("client_phone", { p_client: clientId });
    expect(hidden.data).toBeNull();
    // Él sigue viendo el suyo.
    const own = await mateo.rpc("client_phone", { p_client: clientId });
    expect(own.data).toBe(MATEO);

    await setPreference("share_phone_on_booking", true);
    const back = await owner.rpc("client_phone", { p_client: clientId });
    expect(back.data).toBe(MATEO);
  });

  it("con los mensajes de las citas apagados, la confirmación no llega a la bandeja", async () => {
    await setPreference("whatsapp_booking_messages", false);
    expect(await confirmations(await newBooking())).toBe(0);

    await setPreference("whatsapp_booking_messages", true);
    expect(await confirmations(await newBooking())).toBe(1);
  });

  it("nadie cambia los interruptores de otro", async () => {
    const { data } = await owner
      .from("profiles")
      .update({ whatsapp_promotions: true })
      .eq("id", mateoId)
      .select("id");
    expect(data).toEqual([]);
  });
});
