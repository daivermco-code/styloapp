// Pruebas de la Fase 4 contra el Supabase local (T-4.4.1): solo el dueño bloquea clientes y crea
// series (y les liga citas), y quitar un bloqueo pide el mismo permiso que ponerlo. El bloqueo
// encima de una cita y el bloqueo sin permiso ya los prueba agenda.test.ts. Necesitan
// `npm run db:start` y `.env.local`.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDemo, signIn, sql } from "./helpers";

const OWNER = "+573005550101"; // Valentina Ríos, Barbería La Clásica
const STAFF = "+573005550111"; // Camilo Rojas, de La Clásica

interface Ids {
  business: string;
  camilo: string;
  service: string;
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

/** Un día en Bogotá, `days` días después de hoy, y un instante de ese día. */
async function dayAt(
  days: number,
  time: string,
): Promise<{ day: string; iso: string }> {
  return one<{ day: string; iso: string }>(
    `select to_char((now() at time zone 'America/Bogota')::date + $1::int, 'YYYY-MM-DD') as day,
            to_char(((((now() at time zone 'America/Bogota')::date + $1::int) + $2::time)
              at time zone 'America/Bogota') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as iso`,
    [days, time],
  );
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
         where p.phone = $1`,
        [STAFF],
      )
    ).id,
    service: (
      await one<{ id: string }>(
        "select id from public.services where business_id = $1 and name = 'Corte clásico'",
        [business.id],
      )
    ).id,
    walkIn: (
      await one<{ id: string }>(
        `select id from public.clients
         where business_id = $1 and profile_id is null order by full_name limit 1`,
        [business.id],
      )
    ).id,
  };
});

afterAll(resetDemo);

beforeEach(async () => {
  await setPermission("manual_booking", true);
  await setPermission("manual_block", true);
});

describe("clientes bloqueados", () => {
  it("solo el dueño los bloquea y desbloquea", async () => {
    const isBlocked = async () =>
      (
        await one<{ blocked: boolean }>(
          "select is_blocked as blocked from public.clients where id = $1",
          [ids.walkIn],
        )
      ).blocked;

    const staff = await signIn(STAFF);
    const { data: staffRows, error: staffError } = await staff.client
      .from("clients")
      .update({ is_blocked: true })
      .eq("id", ids.walkIn)
      .select("id");
    expect(staffError).toBeNull();
    expect(staffRows).toEqual([]);
    expect(await isBlocked()).toBe(false);

    const owner = await signIn(OWNER);
    const { error: blockError } = await owner.client
      .from("clients")
      .update({ is_blocked: true })
      .eq("id", ids.walkIn);
    expect(blockError).toBeNull();
    expect(await isBlocked()).toBe(true);

    await owner.client
      .from("clients")
      .update({ is_blocked: false })
      .eq("id", ids.walkIn);
    expect(await isBlocked()).toBe(false);
  });
});

describe("series", () => {
  it("solo el dueño crea series y les liga citas", async () => {
    const { day, iso } = await dayAt(43, "10:00");
    const series = {
      business_id: ids.business,
      staff_id: ids.camilo,
      service_id: ids.service,
      client_id: ids.walkIn,
      weekday: new Date(`${day}T12:00:00Z`).getUTCDay(),
      start_time: "10:00",
      frequency: "weekly" as const,
      starts_on: day,
      occurrences: 4,
    };
    const staff = await signIn(STAFF);
    const { error: staffSeries } = await staff.client
      .from("recurring_bookings")
      .insert(series);
    expect(staffSeries?.code).toBe("42501");

    const owner = await signIn(OWNER);
    const { data: created, error: ownerSeries } = await owner.client
      .from("recurring_bookings")
      .insert(series)
      .select("id")
      .single();
    expect(ownerSeries).toBeNull();

    const booking = {
      business_id: ids.business,
      staff_id: ids.camilo,
      service_id: ids.service,
      client_id: ids.walkIn,
      starts_at: iso,
      ends_at: plusMinutes(iso, 30),
      price: 25000,
      recurring_id: created?.id,
    };
    const { error: staffBooking } = await staff.client
      .from("bookings")
      .insert(booking);
    expect(staffBooking?.message).toBe("NO_PERMISSION_TEAM");

    const { error: ownerBooking } = await owner.client
      .from("bookings")
      .insert(booking);
    expect(ownerBooking).toBeNull();
  });
});

describe("quitar bloqueos", () => {
  it("pide el mismo permiso que ponerlos", async () => {
    const { iso } = await dayAt(43, "16:00");
    const owner = await signIn(OWNER);
    const { data: block } = await owner.client
      .from("agenda_blocks")
      .insert({
        business_id: ids.business,
        staff_id: ids.camilo,
        starts_at: iso,
        ends_at: plusMinutes(iso, 60),
      })
      .select("id")
      .single();
    expect(block).not.toBeNull();

    const staff = await signIn(STAFF);
    await setPermission("manual_block", false);
    const { data: denied } = await staff.client
      .from("agenda_blocks")
      .delete()
      .eq("id", block?.id ?? "")
      .select("id");
    expect(denied).toEqual([]);

    await setPermission("manual_block", true);
    const { data: removed } = await staff.client
      .from("agenda_blocks")
      .delete()
      .eq("id", block?.id ?? "")
      .select("id");
    expect(removed).toEqual([{ id: block?.id }]);
  });
});
