// Pruebas de la Fase 1 contra el Supabase local: RLS, permisos de funciones, entrada con
// código, vinculación y reinicio. Necesitan `npm run db:start` y `.env.local`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, resetDemo, signIn, sql } from "./helpers";

const OWNER = "+573005550101"; // Valentina Ríos, Barbería La Clásica
const STAFF = "+573005550111"; // Camilo Rojas
const FREE_STAFF = "+573005550114"; // Laura Méndez, sin negocio
const CLIENT = "+573005550121"; // Mateo Gómez
const CLIENT_2 = "+573005550122"; // Daniela Ruiz
const CLIENT_3 = "+573005550123"; // Santiago López
const NEW_PHONE = "+573005550199"; // no está en la semilla

async function linkCodeOf(slug: string): Promise<string> {
  const rows = await sql<{ code: string }>(
    `select c.code from public.business_link_codes c
     join public.businesses b on b.id = c.business_id where b.slug = $1`,
    [slug],
  );
  return rows[0].code;
}

beforeAll(resetDemo);
afterAll(resetDemo);

describe("estructura de la base", () => {
  it("todas las tablas de public tienen RLS", async () => {
    const withoutRls = await sql(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity`,
    );
    expect(withoutRls).toEqual([]);
  });

  it("las funciones security definer tienen search_path vacío", async () => {
    const unsafe = await sql(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef
         and not coalesce(p.proconfig, '{}') @> array['search_path=""']`,
    );
    expect(unsafe).toEqual([]);
  });

  it("la semilla, el reinicio y el hook no los llaman anon ni authenticated", async () => {
    const functions = [
      "public.seed_demo()",
      "public.seed_demo_clients(uuid, uuid)",
      "public.seed_demo_bookings(uuid)",
      "public.reset_demo()",
      "public.create_demo_person(text, text, text, integer)",
      "public.send_sms_demo(jsonb)",
      "public.new_link_code()",
    ];
    for (const fn of functions) {
      for (const role of ["anon", "authenticated"]) {
        const [row] = await sql<{ allowed: boolean }>(
          "select has_function_privilege($1, $2, 'execute') as allowed",
          [role, fn],
        );
        expect(row.allowed, `${role} → ${fn}`).toBe(false);
      }
    }
    const { error } = await anonClient().rpc("reset_demo");
    expect(error).not.toBeNull();
  });

  it("link_staff y home_counters piden sesión", async () => {
    for (const fn of [
      "public.link_staff(text, text)",
      "public.home_counters(uuid)",
    ]) {
      const [row] = await sql<{ anon: boolean; authenticated: boolean }>(
        `select has_function_privilege('anon', $1, 'execute') as anon,
                has_function_privilege('authenticated', $1, 'execute') as authenticated`,
        [fn],
      );
      expect(row, fn).toEqual({ anon: false, authenticated: true });
    }
  });

  it("la bandeja está en Realtime", async () => {
    const rows = await sql(
      `select tablename from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'demo_messages'`,
    );
    expect(rows).toHaveLength(1);
  });
});

describe("entrada con el código de la bandeja", () => {
  it("una persona sembrada entra y conserva su lado de demo", async () => {
    const { client, user } = await signIn(CLIENT);
    expect(user.phone).toBe("573005550121");

    const { data: me } = await client.auth.getUser();
    expect(me.user?.id).toBe(user.id);

    const { data: profile } = await client
      .from("profiles")
      .select("*")
      .single();
    expect(profile?.full_name).toBe("Mateo Gómez");
    expect(profile?.phone).toBe(CLIENT);

    const { data: admin } = await adminClient().auth.admin.getUserById(user.id);
    expect(admin.user?.app_metadata.demo_side).toBe("client");
  });

  it("un celular que no está en la demo no recibe código sin crear cuenta", async () => {
    const { error } = await anonClient().auth.signInWithOtp({
      phone: NEW_PHONE,
      options: { shouldCreateUser: false },
    });
    expect(error).not.toBeNull();
  });

  it("un código errado no abre sesión", async () => {
    const client = anonClient();
    await client.auth.signInWithOtp({
      phone: CLIENT_2,
      options: { shouldCreateUser: false },
    });
    const { error } = await client.auth.verifyOtp({
      phone: CLIENT_2,
      token: "000000",
      type: "sms",
    });
    expect(error?.code).toBe("otp_expired");
  });
});

describe("RLS de la Fase 1", () => {
  it("cada quien ve solo sus mensajes y su perfil", async () => {
    const client = await signIn(CLIENT);
    const staff = await signIn(STAFF);
    for (const [session, phone] of [
      [client, CLIENT],
      [staff, STAFF],
    ] as const) {
      const { data: messages } = await session.client
        .from("demo_messages")
        .select("recipient_phone");
      expect(messages?.length).toBeGreaterThan(0);
      expect(messages?.every((m) => m.recipient_phone === phone)).toBe(true);

      const { data: profiles } = await session.client
        .from("profiles")
        .select("phone");
      expect(profiles).toEqual([{ phone }]);
    }
  });

  it("nadie escribe mensajes ni cambia su celular desde la app", async () => {
    const { client, user } = await signIn(CLIENT);
    const { error: insertError } = await client.from("demo_messages").insert({
      recipient_phone: CLIENT,
      channel: "sms",
      kind: "login_code",
      title: "x",
      body: "x",
    });
    expect(insertError).not.toBeNull();

    const { error: phoneError } = await client
      .from("profiles")
      .update({ phone: NEW_PHONE })
      .eq("id", user.id);
    expect(phoneError).not.toBeNull();
  });

  it("sin cuenta se ven los negocios, el equipo y el catálogo, pero no los códigos", async () => {
    const anon = anonClient();
    const { data: businesses } = await anon.from("businesses").select("id");
    const { data: staff } = await anon.from("staff").select("id");
    const { data: services } = await anon.from("services").select("id");
    const { data: codes } = await anon
      .from("business_link_codes")
      .select("code");
    expect(businesses).toHaveLength(5);
    expect(staff).toHaveLength(8);
    expect(services).toHaveLength(37);
    expect(codes).toEqual([]);
  });

  it("el código de vinculación solo lo ve el dueño", async () => {
    const owner = await signIn(OWNER);
    const staff = await signIn(STAFF);
    const { data: ownerCodes } = await owner.client
      .from("business_link_codes")
      .select("code");
    const { data: staffCodes } = await staff.client
      .from("business_link_codes")
      .select("code");
    expect(ownerCodes).toEqual([
      { code: await linkCodeOf("barberia-la-clasica") },
    ]);
    expect(staffCodes).toEqual([]);
  });

  it("el profesional solo cambia la duración de sus servicios", async () => {
    const { client, user } = await signIn(STAFF);
    const [{ id: staffId }] = await sql<{ id: string }>(
      "select id from public.staff where profile_id = $1",
      [user.id],
    );
    const { error: priceError } = await client
      .from("staff_services")
      .update({ price: 1000 })
      .eq("staff_id", staffId);
    expect(priceError).not.toBeNull();

    const { error: durationError } = await client
      .from("staff_services")
      .update({ duration_minutes: 50 })
      .eq("staff_id", staffId);
    expect(durationError).toBeNull();
  });

  it("home_counters responde al equipo y a nadie más", async () => {
    const [{ id: businessId }] = await sql<{ id: string }>(
      "select id from public.businesses where slug = 'barberia-la-clasica'",
    );
    const owner = await signIn(OWNER);
    const client = await signIn(CLIENT);
    const { data: ownerCounters } = await owner.client.rpc("home_counters", {
      p_business: businessId,
    });
    const { data: clientCounters } = await client.client.rpc("home_counters", {
      p_business: businessId,
    });
    expect(ownerCounters).toHaveLength(1);
    expect(clientCounters).toEqual([]);
  });
});

describe("vincular un profesional (link_staff)", () => {
  it("se vincula con el código, una sola vez, y respeta el cupo", async () => {
    const code = await linkCodeOf("barberia-la-clasica");

    const laura = await signIn(FREE_STAFF);
    const { error: notFound } = await laura.client.rpc("link_staff", {
      p_code: "ZZZZZZ",
      p_display_name: "Laura",
    });
    expect(notFound?.message).toBe("LINK_CODE_NOT_FOUND");

    const { data: staffId, error } = await laura.client.rpc("link_staff", {
      p_code: code.toLowerCase(),
      p_display_name: "Laura",
    });
    expect(error).toBeNull();
    expect(staffId).toBeTruthy();

    const { error: again } = await laura.client.rpc("link_staff", {
      p_code: code,
      p_display_name: "Laura",
    });
    expect(again?.message).toBe("ALREADY_LINKED");
    expect(again?.details).toBe("Barbería La Clásica");

    // Camilo, Julián, Sofía y Laura: con uno más se llena (5 profesionales además del dueño).
    const fifth = await signIn(CLIENT_2);
    const { error: fifthError } = await fifth.client.rpc("link_staff", {
      p_code: code,
      p_display_name: "Daniela",
    });
    expect(fifthError).toBeNull();

    const sixth = await signIn(CLIENT_3);
    const { error: full } = await sixth.client.rpc("link_staff", {
      p_code: code,
      p_display_name: "Santiago",
    });
    expect(full?.message).toBe("TEAM_FULL");
  });
});

describe("reiniciar la demo", () => {
  it("borra lo hecho, las cuentas nuevas y vuelve a sembrar", async () => {
    const created = await signIn(NEW_PHONE, true);
    expect(created.user.id).toBeTruthy();

    await resetDemo();

    const [counts] = await sql<{
      profiles: string;
      staff: string;
      messages: string;
      newcomer: string;
    }>(
      `select (select count(*) from public.profiles) as profiles,
              (select count(*) from public.staff) as staff,
              (select count(*) from public.demo_messages) as messages,
              (select count(*) from auth.users where phone = '573005550199') as newcomer`,
    );
    // 15 personas de la pantalla de inicio y 20 clientes con cuenta que no salen ahí (Fase 3);
    // los 3 mensajes son los avisos de la cita sembrada a 2 h 10 min.
    expect(counts).toEqual({
      profiles: "35",
      staff: "8",
      messages: "3",
      newcomer: "0",
    });

    // La sesión de antes ya no sirve.
    const { data } = await created.client.auth.getUser();
    expect(data.user).toBeNull();
  });
});
