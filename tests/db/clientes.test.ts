// Pruebas de la Fase 5 contra el Supabase local (T-5.6.1, US-035 parte de clientes): el cliente
// no ve citas ni datos de otros; client_book revisa el bloqueo, las reservas en línea y el
// horario; dos reservas a la misma hora al mismo tiempo dejan entrar una; y hay una reseña por
// cita propia ya empezada, ninguna en canceladas ni en "no llegó". De la Fase 6: cambiar y
// cancelar como cliente con el límite del negocio. Necesitan `npm run db:start` y `.env.local`.
import { beforeAll, describe, expect, it } from "vitest";
import type { TablesInsert } from "@/shared/types/database";
import { anonClient, type Db, resetDemo, signIn, sql } from "./helpers";

const MATEO = "+573005550121";
const DANIELA = "+573005550122";
const SANTIAGO = "+573005550123";

interface Person {
  client: Db;
  id: string;
}

interface Ids {
  business: string;
  camilo: string;
  service: string;
}

let ids: Ids;
let mateo: Person;
let daniela: Person;
let santiago: Person;

async function one<T extends Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T> {
  const [row] = await sql<T>(text, values);
  return row;
}

async function person(phone: string): Promise<Person> {
  const { client, user } = await signIn(phone);
  return { client, id: user.id };
}

/**
 * Un instante libre para el profesional: el primer día de los próximos (desde pasado mañana) en
 * que él y el negocio atienden a esa hora, sin citas ni bloqueos entre esa hora y una hora
 * después (los de la semilla se borran).
 */
async function freeSlot(staffId: string, time: string): Promise<string> {
  const { iso } = await one<{ iso: string }>(
    `select to_char(((d::date + $2::time) at time zone 'America/Bogota') at time zone 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS"Z"') as iso
     from generate_series((now() at time zone 'America/Bogota')::date + 2,
                          (now() at time zone 'America/Bogota')::date + 9, interval '1 day') d
     where exists (
       select 1 from public.work_hours ws
       join public.work_hours wb on wb.business_id = ws.business_id and wb.staff_id is null
                                and wb.weekday = ws.weekday
       where ws.staff_id = $1 and ws.weekday = extract(dow from d)
         and greatest(ws.starts, wb.starts) <= $2::time
         and least(ws.ends, wb.ends) >= $2::time + interval '1 hour')
     order by d limit 1`,
    [staffId, time],
  );
  const until = new Date(Date.parse(iso) + 60 * 60_000).toISOString();
  for (const table of ["bookings", "agenda_blocks"]) {
    await sql(
      `delete from public.${table} where staff_id = $1 and starts_at < $3 and ends_at > $2`,
      [staffId, iso, until],
    );
  }
  return iso;
}

function book(who: Person, startsAt: string, promos = false) {
  return who.client.rpc("client_book", {
    p_service: ids.service,
    p_staff: ids.camilo,
    p_starts_at: startsAt,
    p_promos: promos,
  });
}

beforeAll(async () => {
  await resetDemo();
  const business = await one<{ id: string }>(
    "select id from public.businesses where slug = 'barberia-la-clasica'",
  );
  ids = {
    business: business.id,
    camilo: (
      await one<{ id: string }>(
        `select s.id from public.staff s join public.profiles p on p.id = s.profile_id
         where p.phone = '+573005550111'`,
      )
    ).id,
    service: (
      await one<{ id: string }>(
        "select id from public.services where business_id = $1 and name = 'Corte clásico'",
        [business.id],
      )
    ).id,
  };
  mateo = await person(MATEO);
  daniela = await person(DANIELA);
  santiago = await person(SANTIAGO);
});

describe("privacidad del cliente", () => {
  it("ve solo sus citas, sus fichas y su perfil", async () => {
    const mine = await sql<{ id: string }>(
      "select id from public.clients where profile_id = $1",
      [mateo.id],
    );
    const fichas = mine.map((row) => row.id);

    const { data: bookings } = await mateo.client
      .from("bookings")
      .select("client_id");
    expect(bookings?.length).toBeGreaterThan(0);
    for (const row of bookings ?? []) expect(fichas).toContain(row.client_id);

    const { data: clients } = await mateo.client
      .from("clients")
      .select("profile_id");
    expect(clients?.map((row) => row.profile_id)).toEqual(
      fichas.map(() => mateo.id),
    );

    const { data: profiles } = await mateo.client.from("profiles").select("id");
    expect(profiles).toEqual([{ id: mateo.id }]);
  });

  it("de la agenda ajena solo ve rangos ocupados", async () => {
    const day = new Date().toISOString().slice(0, 10);
    const { data, error } = await mateo.client.rpc("busy_ranges", {
      p_staff: ids.camilo,
      p_day: day,
    });
    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect(Object.keys(row).sort()).toEqual(["ends_at", "starts_at"]);
    }
  });
});

describe("client_book", () => {
  it("reserva con el fin y el precio de la base, como reservada por el cliente", async () => {
    const startsAt = await freeSlot(ids.camilo, "09:00");
    const { data: id, error } = await book(mateo, startsAt);
    expect(error).toBeNull();
    const row = await one<{
      booked_by: string;
      minutes: number;
      price: number;
      profile_id: string;
    }>(
      `select b.booked_by, extract(epoch from b.ends_at - b.starts_at) / 60 as minutes,
              b.price, c.profile_id
       from public.bookings b join public.clients c on c.id = b.client_id where b.id = $1`,
      [id],
    );
    expect(row.booked_by).toBe("client");
    expect(Number(row.minutes)).toBeGreaterThan(0);
    expect(Number(row.price)).toBeGreaterThan(0);
    expect(row.profile_id).toBe(mateo.id);
  });

  it("no deja reservar al cliente bloqueado y, desbloqueado, vuelve a reservar", async () => {
    const startsAt = await freeSlot(ids.camilo, "11:00");
    await sql(
      "update public.clients set is_blocked = true where business_id = $1 and profile_id = $2",
      [ids.business, mateo.id],
    );
    try {
      const { error } = await book(mateo, startsAt);
      expect(error?.message).toBe("CLIENT_BLOCKED");
    } finally {
      await sql(
        "update public.clients set is_blocked = false where business_id = $1 and profile_id = $2",
        [ids.business, mateo.id],
      );
    }
    const { error } = await book(mateo, startsAt);
    expect(error).toBeNull();
  });

  it("no deja reservar con las reservas en línea apagadas", async () => {
    const startsAt = await freeSlot(ids.camilo, "11:00");
    await sql(
      "update public.businesses set online_booking = false where id = $1",
      [ids.business],
    );
    try {
      const { error } = await book(mateo, startsAt);
      expect(error?.message).toBe("ONLINE_BOOKING_OFF");
    } finally {
      await sql(
        "update public.businesses set online_booking = true where id = $1",
        [ids.business],
      );
    }
  });

  it("no deja reservar fuera del horario ni en el pasado", async () => {
    const startsAt = await freeSlot(ids.camilo, "11:00");
    const night = new Date(Date.parse(startsAt) - 8 * 60 * 60_000); // 3:00 a. m.
    const past = new Date(Date.now() - 24 * 60 * 60_000);
    for (const when of [night, past]) {
      const { error } = await book(mateo, when.toISOString());
      expect(error?.message).toBe("OUT_OF_HOURS");
    }
  });

  it("sin sesión no reserva", async () => {
    const startsAt = await freeSlot(ids.camilo, "11:00");
    const { error } = await anonClient().rpc("client_book", {
      p_service: ids.service,
      p_staff: ids.camilo,
      p_starts_at: startsAt,
    });
    expect(error).not.toBeNull();
  });

  it("dos reservas a la misma hora al mismo tiempo: una entra y la otra choca", async () => {
    const startsAt = await freeSlot(ids.camilo, "14:00");
    const results = await Promise.all([
      book(daniela, startsAt),
      book(santiago, startsAt, true),
    ]);
    const ok = results.filter((result) => result.error === null);
    const taken = results.filter((result) => result.error?.code === "23P01");
    expect(ok).toHaveLength(1);
    expect(taken).toHaveLength(1);
  });

  it("la casilla de promociones da el permiso y desmarcada no lo quita", async () => {
    const promos = async () =>
      (
        await one<{ promos_ok: boolean }>(
          "select promos_ok from public.clients where business_id = $1 and profile_id = $2",
          [ids.business, santiago.id],
        )
      ).promos_ok;
    await sql(
      "update public.clients set promos_ok = false where business_id = $1 and profile_id = $2",
      [ids.business, santiago.id],
    );
    expect(
      (await book(santiago, await freeSlot(ids.camilo, "16:00"), true)).error,
    ).toBeNull();
    expect(await promos()).toBe(true);
    expect(
      (await book(santiago, await freeSlot(ids.camilo, "17:00"))).error,
    ).toBeNull();
    expect(await promos()).toBe(true);
  });
});

// Fase 6 (US-029): cambiar la hora y cancelar como cliente, con el límite de cancelación del
// negocio (15 minutos en la semilla).
describe("client_reschedule y client_cancel", () => {
  /** Una cita de Mateo con Camilo que empieza en `minutes` minutos (lo que se cruce se borra). */
  async function bookingIn(minutes: number): Promise<string> {
    const span = `now() + interval '${minutes} minutes', now() + interval '${minutes + 30} minutes'`;
    for (const table of ["bookings", "agenda_blocks"]) {
      await sql(
        `delete from public.${table} where staff_id = $1
           and starts_at < now() + interval '${minutes + 30} minutes'
           and ends_at > now() + interval '${minutes} minutes'`,
        [ids.camilo],
      );
    }
    const row = await one<{ id: string }>(
      `insert into public.bookings
         (business_id, staff_id, service_id, client_id, booked_by, starts_at, ends_at, price)
       select $1, $2, $3, c.id, 'client', ${span}, 25000
       from public.clients c where c.business_id = $1 and c.profile_id = $4
       returning id`,
      [ids.business, ids.camilo, ids.service, mateo.id],
    );
    return row.id;
  }

  it("cambia la hora con el mismo servicio, profesional y precio", async () => {
    const { data: id } = await book(mateo, await freeSlot(ids.camilo, "14:00"));
    const later = await freeSlot(ids.camilo, "16:00");
    const { error } = await mateo.client.rpc("client_reschedule", {
      p_booking: id ?? "",
      p_starts_at: later,
    });
    expect(error).toBeNull();
    const row = await one<{
      starts_at: Date;
      staff_id: string;
      status: string;
    }>(
      "select starts_at, staff_id, status from public.bookings where id = $1",
      [id],
    );
    expect(row.starts_at.toISOString()).toBe(new Date(later).toISOString());
    expect(row.staff_id).toBe(ids.camilo);
    expect(row.status).toBe("pending");
  });

  it("cancela dentro del límite y la cita queda cancelada", async () => {
    const id = await bookingIn(120);
    const { error } = await mateo.client.rpc("client_cancel", {
      p_booking: id,
    });
    expect(error).toBeNull();
    const row = await one<{ status: string }>(
      "select status from public.bookings where id = $1",
      [id],
    );
    expect(row.status).toBe("cancelled");
  });

  it("pasado el límite no cambia ni cancela, y una cancelada ya no se toca", async () => {
    const id = await bookingIn(10);
    const cancel = await mateo.client.rpc("client_cancel", { p_booking: id });
    expect(cancel.error?.message).toBe("TOO_LATE");
    const move = await mateo.client.rpc("client_reschedule", {
      p_booking: id,
      p_starts_at: await freeSlot(ids.camilo, "17:00"),
    });
    expect(move.error?.message).toBe("TOO_LATE");

    await sql("update public.bookings set status = 'cancelled' where id = $1", [
      id,
    ]);
    const again = await mateo.client.rpc("client_cancel", { p_booking: id });
    expect(again.error?.message).toBe("BOOKING_LOCKED");
  });

  it("nadie cambia ni cancela la cita de otro", async () => {
    const id = await bookingIn(180);
    const { error } = await daniela.client.rpc("client_cancel", {
      p_booking: id,
    });
    expect(error?.message).toBe("NOT_FOUND");
    const row = await one<{ status: string }>(
      "select status from public.bookings where id = $1",
      [id],
    );
    expect(row.status).toBe("pending");
  });
});

describe("reseñas", () => {
  /** Las citas efectivas pasadas de una persona en La Clásica, sin sus reseñas. */
  async function pastBookings(who: Person, count: number): Promise<string[]> {
    const rows = await sql<{ id: string }>(
      `select b.id from public.bookings b join public.clients c on c.id = b.client_id
       where c.profile_id = $1 and b.status = 'successful' and b.starts_at < now()
       order by b.starts_at desc limit $2`,
      [who.id, count],
    );
    const found = rows.map((row) => row.id);
    await sql("delete from public.reviews where booking_id = any($1::uuid[])", [
      found,
    ]);
    return found;
  }

  function review(who: Person, bookingId: string) {
    return (
      who.client
        .from("reviews")
        // `business_id` y `staff_id` los pone `reviews_fill`; los tipos generados no lo saben.
        .insert({
          booking_id: bookingId,
          attention: 5,
          quality: 4,
        } as TablesInsert<"reviews">)
        .select("business_id, staff_id, author_id")
        .single()
    );
  }

  it("una por cita propia: la base pone el negocio, el profesional y el autor", async () => {
    const [bookingId] = await pastBookings(daniela, 1);
    const before = await one<{ reviews: string }>(
      "select reviews from public.business_rating where business_id = $1",
      [ids.business],
    );

    const { data, error } = await review(daniela, bookingId);
    expect(error).toBeNull();
    expect(data?.business_id).toBe(ids.business);
    expect(data?.author_id).toBe(daniela.id);
    expect(data?.staff_id).toBeTruthy();

    const after = await one<{ reviews: string }>(
      "select reviews from public.business_rating where business_id = $1",
      [ids.business],
    );
    expect(Number(after.reviews)).toBe(Number(before.reviews) + 1);

    const again = await review(daniela, bookingId);
    expect(again.error?.code).toBe("23505");
  });

  it("no se califica una cita cancelada, una marcada 'no llegó', una ajena ni una futura", async () => {
    const [cancelled, noShow, others] = await pastBookings(mateo, 3);
    await sql("update public.bookings set status = 'cancelled' where id = $1", [
      cancelled,
    ]);
    await sql("update public.bookings set punctuality = 1 where id = $1", [
      noShow,
    ]);
    const { data: future } = await book(
      mateo,
      await freeSlot(ids.camilo, "10:00"),
    );

    for (const bookingId of [cancelled, noShow]) {
      expect((await review(mateo, bookingId)).error?.code).toBe("42501");
    }
    expect((await review(daniela, others)).error?.code).toBe("42501");
    expect((await review(mateo, String(future))).error?.code).toBe("42501");
  });
});
