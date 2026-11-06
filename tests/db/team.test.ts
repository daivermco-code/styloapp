// Pruebas de la Fase 2 contra el Supabase local (T-2.5.1): lo que el profesional no puede
// cambiar, los errores de link_staff y lo que pasa al desactivar. Necesitan `npm run db:start`
// y `.env.local`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDemo, signIn, sql } from "./helpers";

const OWNER = "+573005550101"; // Valentina Ríos, Barbería La Clásica
const OTHER_OWNER = "+573005550102"; // Andrés Castillo, Uñas y Arte Spa
const STAFF = "+573005550111"; // Camilo Rojas, de La Clásica
const FREE_STAFF = "+573005550114"; // Laura Méndez, sin negocio
const CLASICA = "barberia-la-clasica";
const UNAS = "unas-y-arte-spa";

async function one<T extends Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T> {
  const [row] = await sql<T>(text, values);
  return row;
}

const businessId = async (slug: string) =>
  (
    await one<{ id: string }>(
      "select id from public.businesses where slug = $1",
      [slug],
    )
  ).id;

const staffIdOf = async (phone: string) =>
  (
    await one<{ id: string }>(
      `select s.id from public.staff s join public.profiles p on p.id = s.profile_id
       where p.phone = $1 and s.is_active`,
      [phone],
    )
  ).id;

const linkCodeOf = async (slug: string) =>
  (
    await one<{ code: string }>(
      `select c.code from public.business_link_codes c
       join public.businesses b on b.id = c.business_id where b.slug = $1`,
      [slug],
    )
  ).code;

beforeAll(resetDemo);
afterAll(resetDemo);

describe("el profesional no cambia lo del negocio", () => {
  it("no edita el catálogo", async () => {
    const { client } = await signIn(STAFF);
    const clasica = await businessId(CLASICA);
    const service = await one<{ id: string; category_id: string }>(
      "select id, category_id from public.services where business_id = $1 limit 1",
      [clasica],
    );

    const { error: categoryError } = await client
      .from("service_categories")
      .insert({ business_id: clasica, name: "Categoría del profesional" });
    expect(categoryError?.code).toBe("42501");

    const { error: serviceError } = await client.from("services").insert({
      business_id: clasica,
      category_id: service.category_id,
      name: "Servicio del profesional",
      duration_minutes: 30,
      price: 1000,
    });
    expect(serviceError?.code).toBe("42501");

    // Sin permiso, el cambio no toca ninguna fila.
    const { data: updated } = await client
      .from("services")
      .update({ price: 1 })
      .eq("id", service.id)
      .select("id");
    expect(updated).toEqual([]);
    const { price } = await one<{ price: number }>(
      "select price from public.services where id = $1",
      [service.id],
    );
    expect(price).not.toBe(1);
  });

  it("no cambia el horario ni los servicios de otro profesional", async () => {
    const { client } = await signIn(STAFF);
    const clasica = await businessId(CLASICA);
    const julian = await one<{ id: string }>(
      "select id from public.staff where business_id = $1 and display_name = 'Julián'",
      [clasica],
    );
    const service = await one<{ id: string }>(
      "select id from public.services where business_id = $1 limit 1",
      [clasica],
    );

    const { error: hoursError } = await client.from("work_hours").insert({
      business_id: clasica,
      staff_id: julian.id,
      weekday: 0,
      starts: "10:00",
      ends: "12:00",
    });
    expect(hoursError?.code).toBe("42501");

    const { data: deleted } = await client
      .from("work_hours")
      .delete()
      .eq("staff_id", julian.id)
      .select("id");
    expect(deleted).toEqual([]);

    const { error: servicesError } = await client
      .from("staff_services")
      .upsert({
        staff_id: julian.id,
        service_id: service.id,
        duration_minutes: 90,
      });
    expect(servicesError?.code).toBe("42501");

    // Tampoco su nombre ni si está activo (eso es del dueño).
    const { data: renamed } = await client
      .from("staff")
      .update({ display_name: "Otro nombre", is_active: false })
      .eq("id", julian.id)
      .select("id");
    expect(renamed).toEqual([]);
  });

  it("no pone precio ni comisión a sus servicios, pero sí su duración", async () => {
    const { client } = await signIn(STAFF);
    const camilo = await staffIdOf(STAFF);
    const free = await one<{ id: string }>(
      `select sv.id from public.services sv
       where sv.business_id = $1 and sv.is_active
         and not exists (select 1 from public.staff_services ss
                         where ss.staff_id = $2 and ss.service_id = sv.id)
       limit 1`,
      [await businessId(CLASICA), camilo],
    );

    const { error: priceError } = await client
      .from("staff_services")
      .insert({ staff_id: camilo, service_id: free.id, price: 5000 });
    expect(priceError?.code).toBe("42501");

    const { error: commissionError } = await client
      .from("staff_services")
      .update({ commission_pct: 50 })
      .eq("staff_id", camilo);
    expect(commissionError?.code).toBe("42501");

    // Agregar un servicio suyo con su duración, y quitarlo, sí puede.
    const { error: addError } = await client
      .from("staff_services")
      .insert({ staff_id: camilo, service_id: free.id, duration_minutes: 40 });
    expect(addError).toBeNull();
    const { data: removed } = await client
      .from("staff_services")
      .delete()
      .eq("staff_id", camilo)
      .eq("service_id", free.id)
      .select("service_id");
    expect(removed).toHaveLength(1);
  });

  it("el dueño de otro negocio no toca este equipo", async () => {
    const { client } = await signIn(OTHER_OWNER);
    const camilo = await staffIdOf(STAFF);
    const { data } = await client
      .from("staff")
      .update({ is_active: false })
      .eq("id", camilo)
      .select("id");
    expect(data).toEqual([]);
  });
});

describe("vincularse con link_staff", () => {
  it("código que no existe, profesional ya vinculado y equipo lleno", async () => {
    const laura = await signIn(FREE_STAFF);
    const { error: notFound } = await laura.client.rpc("link_staff", {
      p_code: "  zzzzzz ",
      p_display_name: "Laura",
    });
    expect(notFound?.message).toBe("LINK_CODE_NOT_FOUND");

    const camilo = await signIn(STAFF);
    const { error: linked } = await camilo.client.rpc("link_staff", {
      p_code: await linkCodeOf(UNAS),
      p_display_name: "Camilo",
    });
    expect(linked?.message).toBe("ALREADY_LINKED");
    expect(linked?.details).toBe("Barbería La Clásica");

    // Uñas y Arte se llena con 5 profesionales (clientes de la semilla, por la base).
    const unas = await businessId(UNAS);
    await sql(
      `insert into public.staff (business_id, profile_id, role, display_name, position)
       select $1, p.id, 'staff', split_part(p.full_name, ' ', 1), row_number() over ()
       from public.profiles p where p.phone like '+57300555012%'
       order by p.phone limit 5`,
      [unas],
    );
    const { error: full } = await laura.client.rpc("link_staff", {
      p_code: await linkCodeOf(UNAS),
      p_display_name: "Laura",
    });
    expect(full?.message).toBe("TEAM_FULL");
  });
});

describe("desactivar a un profesional", () => {
  it("deja de cambiar su horario y sus servicios, y se conserva lo suyo", async () => {
    const camilo = await signIn(STAFF);
    const staffId = await staffIdOf(STAFF);
    const owner = await signIn(OWNER);

    const { data } = await owner.client
      .from("staff")
      .update({ is_active: false })
      .eq("id", staffId)
      .select("id");
    expect(data).toHaveLength(1);

    const { error: hoursError } = await camilo.client
      .from("work_hours")
      .insert({
        business_id: await businessId(CLASICA),
        staff_id: staffId,
        weekday: 0,
        starts: "10:00",
        ends: "12:00",
      });
    expect(hoursError?.code).toBe("42501");

    const { data: changed } = await camilo.client
      .from("staff_services")
      .update({ duration_minutes: 90 })
      .eq("staff_id", staffId)
      .select("service_id");
    expect(changed).toEqual([]);

    const { count } = await one<{ count: string }>(
      "select count(*) from public.staff_services where staff_id = $1",
      [staffId],
    );
    expect(Number(count)).toBeGreaterThan(0);
  });
});
