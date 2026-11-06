// Pruebas de la Fase 3 contra el Supabase local (T-3.7.1, US-035 en la parte de la agenda):
// quién ve y cambia cada cita, los límites de bookings_guard, la exclusión, los bloqueos, el
// celular del cliente y los avisos que deja cada cambio. Necesitan `npm run db:start` y
// `.env.local`.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { anonClient, resetDemo, signIn, sql } from "./helpers";

const OWNER = "+573005550101"; // Valentina Ríos, Barbería La Clásica
const OTHER_OWNER = "+573005550102"; // Andrés Castillo, Uñas y Arte Spa
const STAFF = "+573005550111"; // Camilo Rojas, de La Clásica
const CLIENT = "+573005550121"; // Mateo Gómez, con cuenta y ficha en La Clásica

interface Ids {
  business: string;
  camilo: string;
  julian: string;
  service: string;
  mateo: string;
  mateoProfile: string;
  walkIn: string;
}

let ids: Ids;

async function one<T extends Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T> {
  const [row] = await sql<T>(text, values);
  return row;
}

/** Un instante en Bogotá, `days` días después de hoy: más allá de las citas sembradas. */
async function at(days: number, time: string): Promise<string> {
  const { iso } = await one<{ iso: string }>(
    `select to_char(((((now() at time zone 'America/Bogota')::date + $1::int) + $2::time)
       at time zone 'America/Bogota') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as iso`,
    [days, time],
  );
  return iso;
}

function plusMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

async function setPermission(name: string, value: boolean): Promise<void> {
  await sql(
    `update public.team_permissions set ${name} = $2 where business_id = $1`,
    [ids.business, value],
  );
}

async function messagesFor(phone: string, bookingId: string) {
  return sql<{ kind: string; channel: string; future: boolean }>(
    `select kind, channel::text, deliver_at > now() as future from public.demo_messages
     where recipient_phone = $1 and booking_id = $2 order by created_at, kind`,
    [phone, bookingId],
  );
}

beforeAll(async () => {
  await resetDemo();
  const staffId = (phone: string) =>
    one<{ id: string }>(
      `select s.id from public.staff s join public.profiles p on p.id = s.profile_id
       where p.phone = $1`,
      [phone],
    );
  const business = await one<{ id: string }>(
    "select id from public.businesses where slug = 'barberia-la-clasica'",
  );
  const mateo = await one<{ id: string; profile_id: string }>(
    `select c.id, c.profile_id from public.clients c join public.profiles p on p.id = c.profile_id
     where p.phone = $1`,
    [CLIENT],
  );
  ids = {
    business: business.id,
    camilo: (await staffId(STAFF)).id,
    julian: (await staffId("+573005550112")).id,
    service: (
      await one<{ id: string }>(
        "select id from public.services where business_id = $1 and name = 'Corte clásico'",
        [business.id],
      )
    ).id,
    mateo: mateo.id,
    mateoProfile: mateo.profile_id,
    walkIn: (
      await one<{ id: string }>(
        `select id from public.clients
         where business_id = $1 and profile_id is null and phone is not null limit 1`,
        [business.id],
      )
    ).id,
  };
});

afterAll(resetDemo);

beforeEach(async () => {
  await setPermission("manual_booking", true);
  await setPermission("manual_block", true);
  await setPermission("see_client_phone", false);
});

describe("quién ve cada cita", () => {
  it("el profesional ve solo las suyas y el dueño de otro negocio ninguna", async () => {
    const staff = await signIn(STAFF);
    const { data: own } = await staff.client
      .from("bookings")
      .select("staff_id");
    expect(own?.length).toBeGreaterThan(0);
    expect(own?.every((row) => row.staff_id === ids.camilo)).toBe(true);

    const other = await signIn(OTHER_OWNER);
    const { data: none } = await other.client
      .from("bookings")
      .select("id")
      .eq("business_id", ids.business);
    expect(none).toEqual([]);
  });

  it("el cliente ve solo las de su ficha y no las cambia directo", async () => {
    const client = await signIn(CLIENT);
    const { data } = await client.client.from("bookings").select("client_id");
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((row) => row.client_id === ids.mateo)).toBe(true);

    const { data: changed } = await client.client
      .from("bookings")
      .update({ note: "Cambio del cliente" })
      .eq("client_id", ids.mateo)
      .select("id");
    expect(changed).toEqual([]);
  });

  it("busy_ranges no dice de quién son las citas", async () => {
    const { day } = await one<{ day: string }>(
      "select (now() at time zone 'America/Bogota')::date::text as day",
    );
    const { data, error } = await anonClient().rpc("busy_ranges", {
      p_staff: ids.camilo,
      p_day: day,
    });
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    for (const row of data ?? []) {
      expect(Object.keys(row).sort()).toEqual(["ends_at", "starts_at"]);
    }
  });
});

describe("crear y cambiar citas", () => {
  it("sin el permiso de agendar, el profesional no agenda ni cambia; sí marca la llegada", async () => {
    await setPermission("manual_booking", false);
    const staff = await signIn(STAFF);
    const startsAt = await at(40, "10:00");
    const { error: insertError } = await staff.client.from("bookings").insert({
      business_id: ids.business,
      staff_id: ids.camilo,
      service_id: ids.service,
      guest_name: "Cliente de paso",
      starts_at: startsAt,
      ends_at: plusMinutes(startsAt, 30),
      price: 25000,
    });
    expect(insertError?.code).toBe("42501");

    const future = await one<{ id: string }>(
      `select id from public.bookings where staff_id = $1 and status = 'pending'
       and booked_by <> 'client' and starts_at > now() + interval '1 day' limit 1`,
      [ids.camilo],
    );
    const { error: moveError } = await staff.client
      .from("bookings")
      .update({ price: 1 })
      .eq("id", future.id);
    expect(moveError?.message).toBe("NO_PERMISSION_TEAM");

    // La cita de Mateo empezó hace 20 minutos: la llegada sí se marca.
    const started = await one<{ id: string }>(
      `select id from public.bookings where client_id = $1 and status = 'pending'
       and starts_at <= now() order by starts_at desc limit 1`,
      [ids.mateo],
    );
    const { data: marked, error: markError } = await staff.client
      .from("bookings")
      .update({ punctuality: 3, note: "Llegó 10 minutos tarde" })
      .eq("id", started.id)
      .select("status, punctuality_at");
    expect(markError).toBeNull();
    expect(marked?.[0].status).toBe("successful");
    expect(marked?.[0].punctuality_at).not.toBeNull();
  });

  it("la que reservó un cliente solo se cancela, y la que empezó no se cambia ni se cancela", async () => {
    const owner = await signIn(OWNER);
    const byClient = await one<{ id: string; starts_at: Date }>(
      `select id, starts_at from public.bookings where business_id = $1 and booked_by = 'client'
       and status = 'pending' and starts_at > now() + interval '1 day' limit 1`,
      [ids.business],
    );
    const { error: moveError } = await owner.client
      .from("bookings")
      .update({ starts_at: plusMinutes(byClient.starts_at.toISOString(), 15) })
      .eq("id", byClient.id);
    expect(moveError?.message).toBe("BOOKING_LOCKED");
    expect(moveError?.details).toBe("client");

    const { error: cancelError } = await owner.client
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", byClient.id);
    expect(cancelError).toBeNull();

    const started = await one<{ id: string }>(
      `select id from public.bookings where business_id = $1 and status = 'successful'
       and starts_at < now() limit 1`,
      [ids.business],
    );
    for (const change of [{ price: 1 }, { status: "cancelled" as const }]) {
      const { error } = await owner.client
        .from("bookings")
        .update(change)
        .eq("id", started.id);
      expect(error?.details).toBe("started");
    }

    // La llegada no se marca antes de que empiece.
    const future = await one<{ id: string }>(
      `select id from public.bookings where business_id = $1 and status = 'pending'
       and starts_at > now() + interval '1 day' limit 1`,
      [ids.business],
    );
    const { error: earlyError } = await owner.client
      .from("bookings")
      .update({ punctuality: 5 })
      .eq("id", future.id);
    expect(earlyError?.details).toBe("not_started");
  });

  it("dos citas cruzadas no entran: una gana y la otra recibe 23P01", async () => {
    const owner = await signIn(OWNER);
    const staff = await signIn(STAFF);
    const startsAt = await at(41, "11:00");
    const booking = (minutes: number) => ({
      business_id: ids.business,
      staff_id: ids.camilo,
      service_id: ids.service,
      guest_name: "Cliente de paso",
      starts_at: plusMinutes(startsAt, minutes),
      ends_at: plusMinutes(startsAt, minutes + 30),
      price: 25000,
    });
    const results = await Promise.all([
      owner.client.from("bookings").insert(booking(0)),
      staff.client.from("bookings").insert(booking(15)),
    ]);
    const codes = results.map((result) => result.error?.code ?? "ok").sort();
    expect(codes).toEqual(["23P01", "ok"]);

    // Pegada sí entra, y la base pone quién la creó.
    const { data, error } = await owner.client
      .from("bookings")
      .insert(booking(45))
      .select("booked_by, created_by");
    expect(error).toBeNull();
    expect(data?.[0].booked_by).toBe("owner");
    expect(data?.[0].created_by).toBe(owner.user.id);
  });
});

describe("bloqueos", () => {
  it("no caen encima de una cita, ni una cita encima de ellos, y piden permiso", async () => {
    const owner = await signIn(OWNER);
    const staff = await signIn(STAFF);
    const startsAt = await at(42, "15:00");
    const { error: blockError } = await staff.client
      .from("agenda_blocks")
      .insert({
        business_id: ids.business,
        staff_id: ids.camilo,
        starts_at: startsAt,
        ends_at: plusMinutes(startsAt, 60),
      });
    expect(blockError).toBeNull();

    const { error: bookingError } = await owner.client.from("bookings").insert({
      business_id: ids.business,
      staff_id: ids.camilo,
      service_id: ids.service,
      guest_name: "Cliente de paso",
      starts_at: plusMinutes(startsAt, 30),
      ends_at: plusMinutes(startsAt, 60),
      price: 25000,
    });
    expect(bookingError?.code).toBe("23P01");

    const busy = await one<{ id: string; starts_at: Date; ends_at: Date }>(
      `select id, starts_at, ends_at from public.bookings where staff_id = $1
       and status = 'pending' and starts_at > now() + interval '1 day' limit 1`,
      [ids.camilo],
    );
    const { error: overlapError } = await owner.client
      .from("agenda_blocks")
      .insert({
        business_id: ids.business,
        staff_id: ids.camilo,
        starts_at: busy.starts_at.toISOString(),
        ends_at: busy.ends_at.toISOString(),
      });
    expect(overlapError?.message).toBe("BLOCK_OVERLAP");

    await setPermission("manual_block", false);
    const later = await at(42, "18:00");
    const { error: permissionError } = await staff.client
      .from("agenda_blocks")
      .insert({
        business_id: ids.business,
        staff_id: ids.camilo,
        starts_at: later,
        ends_at: plusMinutes(later, 30),
      });
    expect(permissionError?.code).toBe("42501");
  });
});

describe("clientes", () => {
  it("el celular sale según el rol y el permiso, y la columna no se lee directo", async () => {
    const owner = await signIn(OWNER);
    const staff = await signIn(STAFF);
    const { data: ownerPhone } = await owner.client.rpc("client_phone", {
      p_client: ids.walkIn,
    });
    expect(ownerPhone).toMatch(/^\+57300555\d{4}$/);

    const { data: hidden } = await staff.client.rpc("client_phone", {
      p_client: ids.walkIn,
    });
    expect(hidden).toBeNull();
    await setPermission("see_client_phone", true);
    const { data: shown } = await staff.client.rpc("client_phone", {
      p_client: ids.walkIn,
    });
    expect(shown).toBe(ownerPhone);

    const { error } = await owner.client.from("clients").select("phone");
    expect(error?.code).toBe("42501");

    const { data: list } = await staff.client.rpc("business_clients", {
      p_business: ids.business,
    });
    expect(list).toHaveLength(80);
  });

  it("la reputación la ven la persona y el equipo de un negocio donde es cliente", async () => {
    const owner = await signIn(OWNER);
    const other = await signIn(OTHER_OWNER);
    const { data } = await owner.client.rpc("client_reputation", {
      p_profile: ids.mateoProfile,
    });
    expect(Number(data?.[0].rated_bookings)).toBeGreaterThan(0);
    const { data: none } = await other.client.rpc("client_reputation", {
      p_profile: ids.mateoProfile,
    });
    expect(Number(none?.[0].rated_bookings ?? 0)).toBe(0);
  });
});

describe("avisos en la bandeja", () => {
  it("cita nueva, cambio, cancelación y llegada dejan sus mensajes", async () => {
    const owner = await signIn(OWNER);
    const startsAt = await at(43, "10:00");
    const { data, error } = await owner.client
      .from("bookings")
      .insert({
        business_id: ids.business,
        staff_id: ids.camilo,
        service_id: ids.service,
        client_id: ids.mateo,
        starts_at: startsAt,
        ends_at: plusMinutes(startsAt, 30),
        price: 25000,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    const bookingId = data?.id ?? "";
    expect(await messagesFor(CLIENT, bookingId)).toEqual([
      { kind: "booking_confirmed", channel: "whatsapp", future: false },
      { kind: "reminder_1", channel: "whatsapp", future: true },
      { kind: "reminder_2", channel: "whatsapp", future: true },
    ]);
    expect(await messagesFor(STAFF, bookingId)).toEqual([
      { kind: "booking_new_for_staff", channel: "push", future: false },
    ]);

    // Cambio de hora y de profesional: los recordatorios viejos se van y salen los nuevos.
    await owner.client
      .from("bookings")
      .update({
        staff_id: ids.julian,
        starts_at: plusMinutes(startsAt, 60),
        ends_at: plusMinutes(startsAt, 90),
      })
      .eq("id", bookingId);
    const afterChange = await messagesFor(CLIENT, bookingId);
    expect(afterChange.map((m) => m.kind)).toEqual([
      "booking_confirmed",
      "booking_changed",
      "reminder_1",
      "reminder_2",
    ]);
    expect((await messagesFor(STAFF, bookingId)).map((m) => m.kind)).toEqual([
      "booking_new_for_staff",
      "booking_changed",
    ]);

    // Con WhatsApp apagado no le llega el aviso de la cancelación; los recordatorios se borran.
    await sql(
      "update public.profiles set whatsapp_booking_messages = false where phone = $1",
      [CLIENT],
    );
    await owner.client
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);
    expect((await messagesFor(CLIENT, bookingId)).map((m) => m.kind)).toEqual([
      "booking_confirmed",
      "booking_changed",
    ]);
    expect(
      (await messagesFor("+573005550112", bookingId)).map((m) => m.kind),
    ).toEqual(["booking_changed", "booking_cancelled"]);
    await sql(
      "update public.profiles set whatsapp_booking_messages = true where phone = $1",
      [CLIENT],
    );
  });

  it("la cita efectiva invita a calificar", async () => {
    const staff = await signIn(STAFF);
    // La de Mateo que empezó hace 20 minutos, otra vez sin marcar.
    const started = await one<{ id: string }>(
      `update public.bookings set punctuality = null
       where client_id = $1 and starts_at <= now() and starts_at > now() - interval '1 hour'
       returning id`,
      [ids.mateo],
    );
    await sql("delete from public.demo_messages where booking_id = $1", [
      started.id,
    ]);
    await staff.client
      .from("bookings")
      .update({ punctuality: 5 })
      .eq("id", started.id);
    const kinds = (await messagesFor(CLIENT, started.id)).map((m) => m.kind);
    expect(kinds).toContain("booking_successful");
  });
});
