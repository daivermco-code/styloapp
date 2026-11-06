// Pruebas de la Fase 12 contra el Supabase local (T-12.2.2, US-059): los informes cuadran con las
// sumas directas de facturas, ítems y gastos; cada lado ve solo lo suyo (invariante 12); el rango
// se revisa; y Estadísticas es solo del equipo y la visita no guarda a la persona (invariante
// 13). Necesitan `npm run db:start` y `.env.local`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, type Db, resetDemo, signIn, sql } from "./helpers";

const OWNER = "+573005550101"; // Valentina Ríos, Barbería La Clásica
const OTHER_OWNER = "+573005550102"; // Andrés Castillo, Uñas y Arte Spa
const CAMILO = "+573005550111";
const JULIAN = "+573005550112";
const CLIENT = "+573005550121"; // Mateo Gómez, cliente con cuenta

type Summary = {
  services: number;
  products: number;
  expenses: number | null;
  commissions: number;
  invoices: number;
};

async function one<T extends Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T> {
  const [row] = await sql<T>(text, values);
  return row;
}

const staffIdOf = async (phone: string) =>
  (
    await one<{ id: string }>(
      `select s.id from public.staff s join public.profiles p on p.id = s.profile_id
       where p.phone = $1 and s.is_active`,
      [phone],
    )
  ).id;

let clasica: string;
let owner: Db;
let camilo: Db;
let otherOwner: Db;
let client: Db;
let ids: { camilo: string; julian: string; owner: string };
let today: string;
let monthStart: string;
let yearAgo: string;

/** Las sumas directas de las tablas, con la conexión del dueño de la base. */
async function directSums(from: string, to: string, staff: string | null) {
  return one<{
    services: number;
    commissions: number;
    invoices: number;
    totals: number;
    expenses: number;
  }>(
    `select coalesce(sum(ii.price), 0)::int as services,
            coalesce(sum(ii.commission), 0)::int as commissions,
            count(distinct i.id)::int as invoices,
            (select coalesce(sum(x.total), 0)::int from public.invoices x
             where x.business_id = $1 and x.status = 'paid' and x.issued_on between $2 and $3) as totals,
            (select coalesce(sum(e.amount), 0)::int from public.expenses e
             where e.business_id = $1 and e.paid_on between $2 and $3) as expenses
     from public.invoice_items ii
     join public.invoices i on i.id = ii.invoice_id
     where i.business_id = $1 and i.status = 'paid' and i.issued_on between $2 and $3
       and ($4::uuid is null or ii.staff_id = $4)`,
    [clasica, from, to, staff],
  );
}

async function summary(
  db: Db,
  from: string,
  to: string,
  staff?: string,
): Promise<Summary> {
  const { data, error } = await db.rpc("report_summary", {
    p_business: clasica,
    p_from: from,
    p_to: to,
    p_staff: staff,
  });
  expect(error).toBeNull();
  const [row] = data as Summary[];
  return {
    services: Number(row.services),
    products: Number(row.products),
    expenses: row.expenses === null ? null : Number(row.expenses),
    commissions: Number(row.commissions),
    invoices: Number(row.invoices),
  };
}

beforeAll(async () => {
  await resetDemo();
  clasica = (
    await one<{ id: string }>(
      "select id from public.businesses where slug = 'barberia-la-clasica'",
    )
  ).id;
  ids = {
    camilo: await staffIdOf(CAMILO),
    julian: await staffIdOf(JULIAN),
    owner: await staffIdOf(OWNER),
  };
  ({ today, monthStart, yearAgo } = await one<{
    today: string;
    monthStart: string;
    yearAgo: string;
  }>(
    `select d::text as today, date_trunc('month', d)::date::text as "monthStart",
            (d - 365)::text as "yearAgo"
     from (select (now() at time zone 'America/Bogota')::date as d) t`,
  ));
  owner = (await signIn(OWNER)).client;
  camilo = (await signIn(CAMILO)).client;
  otherOwner = (await signIn(OTHER_OWNER)).client;
  client = (await signIn(CLIENT)).client;
});
afterAll(resetDemo);

describe("la semilla de los informes", () => {
  it("hay facturas sin cita de los meses de antes, pagadas mes a mes", async () => {
    const old = await one<{ n: number; pending: number; months: number }>(
      `select count(distinct i.id)::int as n,
              count(*) filter (where ii.staff_payment_id is null and s.role = 'staff')::int as pending,
              count(distinct date_trunc('month', i.issued_on))::int as months
       from public.invoices i
       join public.invoice_items ii on ii.invoice_id = i.id
       join public.staff s on s.id = ii.staff_id
       where i.business_id = $1 and i.booking_id is null`,
      [clasica],
    );
    expect(old.n).toBeGreaterThan(100);
    expect(old.months).toBeGreaterThanOrEqual(4);
    expect(old.pending).toBe(0);
    // Cada pago cubre exactamente lo que dice.
    const wrong = await sql(
      `select sp.id from public.staff_payments sp
       where sp.business_id = $1
         and sp.amount <> (select coalesce(sum(ii.commission), 0) from public.invoice_items ii
                           where ii.staff_payment_id = sp.id)`,
      [clasica],
    );
    expect(wrong).toEqual([]);
  });

  it("hay visitas al perfil de los últimos 90 días, solo del negocio completo", async () => {
    const visits = await sql<{ business_id: string }>(
      "select distinct business_id from public.profile_visits",
    );
    expect(visits).toEqual([{ business_id: clasica }]);
  });
});

describe("report_summary cuadra con las tablas", () => {
  it("el mes y el último año, para el dueño con Todos", async () => {
    for (const from of [monthStart, yearAgo]) {
      const direct = await directSums(from, today, null);
      const row = await summary(owner, from, today);
      expect(row).toEqual({
        services: direct.services,
        products: 0,
        expenses: direct.expenses,
        commissions: direct.commissions,
        invoices: direct.invoices,
      });
      // Ventas generales es el "Total ventas" de Facturas: la suma de los totales.
      expect(row.services).toBe(direct.totals);
      expect(row.services).toBeGreaterThan(0);
    }
  });

  it("las anuladas no cuentan", async () => {
    const voided = await one<{ day: string; total: number }>(
      `select issued_on::text as day, total from public.invoices
       where business_id = $1 and status = 'void'`,
      [clasica],
    );
    const row = await summary(owner, voided.day, voided.day);
    const all = await one<{ total: number }>(
      `select coalesce(sum(total), 0)::int as total from public.invoices
       where business_id = $1 and issued_on = $2`,
      [clasica, voided.day],
    );
    expect(row.services).toBe(all.total - voided.total);
  });

  it("con un profesional elegido, solo lo suyo y sin gastos", async () => {
    const direct = await directSums(monthStart, today, ids.julian);
    const row = await summary(owner, monthStart, today, ids.julian);
    expect(row).toEqual({
      services: direct.services,
      products: 0,
      expenses: null,
      commissions: direct.commissions,
      invoices: direct.invoices,
    });
  });
});

describe("el profesional ve solo lo suyo", () => {
  it("sus indicadores, sin gastos, aunque pida los de otro", async () => {
    const direct = await directSums(yearAgo, today, ids.camilo);
    const expected = {
      services: direct.services,
      products: 0,
      expenses: null,
      commissions: direct.commissions,
      invoices: direct.invoices,
    };
    expect(await summary(camilo, yearAgo, today)).toEqual(expected);
    expect(await summary(camilo, yearAgo, today, ids.julian)).toEqual(expected);
  });

  it("sus servicios y su fila de comisiones", async () => {
    const { data: services, error } = await camilo.rpc("report_services", {
      p_business: clasica,
      p_from: yearAgo,
      p_to: today,
    });
    expect(error).toBeNull();
    const direct = await directSums(yearAgo, today, ids.camilo);
    expect(
      (services ?? []).reduce((sum, row) => sum + Number(row.total), 0),
    ).toBe(direct.services);

    const { data: rows } = await camilo.rpc("report_commissions", {
      p_business: clasica,
      p_from: yearAgo,
      p_to: today,
      p_staff: ids.julian,
    });
    expect((rows ?? []).map((row) => row.staff_id)).toEqual([ids.camilo]);
  });

  it("Métodos de pago no: FORBIDDEN", async () => {
    const { error } = await camilo.rpc("report_methods", {
      p_business: clasica,
      p_from: monthStart,
      p_to: today,
    });
    expect(error?.message).toBe("FORBIDDEN");
  });
});

describe("Ventas, Comisiones y Métodos de pago (dueño)", () => {
  it("Ventas: una fila por servicio, de mayor a menor, que suman Ventas generales", async () => {
    const { data } = await owner.rpc("report_services", {
      p_business: clasica,
      p_from: monthStart,
      p_to: today,
    });
    const rows = (data ?? []).map((row) => ({
      ...row,
      total: Number(row.total),
      times: Number(row.times),
    }));
    expect(rows.length).toBeGreaterThan(1);
    expect(new Set(rows.map((row) => row.service_id)).size).toBe(rows.length);
    const totals = rows.map((row) => row.total);
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
    const row = await summary(owner, monthStart, today);
    expect(totals.reduce((sum, value) => sum + value, 0)).toBe(row.services);
  });

  it("Comisiones: sin el dueño, pagado + pendiente = ganado, y lo pendiente es el del liquidador", async () => {
    const { data, error } = await owner.rpc("report_commissions", {
      p_business: clasica,
      p_from: yearAgo,
      p_to: today,
    });
    expect(error).toBeNull();
    const rows = data ?? [];
    expect(rows.map((row) => row.staff_id)).not.toContain(ids.owner);
    expect(rows.length).toBe(3);
    for (const row of rows) {
      expect(Number(row.paid) + Number(row.pending)).toBe(Number(row.earned));
    }
    // Todo lo pendiente cae en el último año, así que cuadra con el liquidador.
    const { data: payroll } = await owner.rpc("payroll", {
      p_business: clasica,
    });
    for (const person of payroll ?? []) {
      const row = rows.find((r) => r.staff_id === person.staff_id);
      expect(Number(row?.pending ?? 0), person.staff_id).toBe(
        Number(person.pending),
      );
    }
  });

  it("Métodos de pago: suman las ventas y las facturas; uno desactivado sin ventas no sale", async () => {
    await sql(
      `insert into public.payment_methods (business_id, name, is_active, position)
       values ($1, 'Nequi', false, 9)`,
      [clasica],
    );
    const { data, error } = await owner.rpc("report_methods", {
      p_business: clasica,
      p_from: monthStart,
      p_to: today,
    });
    expect(error).toBeNull();
    const rows = data ?? [];
    expect(rows.map((row) => row.name).sort()).toEqual(["Banco", "Efectivo"]);
    const row = await summary(owner, monthStart, today);
    expect(rows.reduce((sum, r) => sum + Number(r.total), 0)).toBe(
      row.services,
    );
    expect(rows.reduce((sum, r) => sum + Number(r.invoices), 0)).toBe(
      row.invoices,
    );
    // Desactivado con ventas en el rango: sí sale.
    await sql(
      `update public.payment_methods set is_active = false
       where business_id = $1 and name = 'Banco'`,
      [clasica],
    );
    const again = await owner.rpc("report_methods", {
      p_business: clasica,
      p_from: monthStart,
      p_to: today,
    });
    expect((again.data ?? []).find((r) => r.name === "Banco")?.is_active).toBe(
      false,
    );
    await sql(
      `update public.payment_methods set is_active = true
       where business_id = $1 and name = 'Banco'`,
      [clasica],
    );
    await sql(
      "delete from public.payment_methods where business_id = $1 and name = 'Nequi'",
      [clasica],
    );
  });
});

describe("rango y quién llama", () => {
  it("al revés o de más de 366 días: INVALID_RANGE; 366 sí", async () => {
    const call = (from: string, to: string) =>
      owner.rpc("report_summary", {
        p_business: clasica,
        p_from: from,
        p_to: to,
      });
    expect((await call("2026-10-15", "2026-10-01")).error?.message).toBe(
      "INVALID_RANGE",
    );
    expect((await call("2028-01-01", "2029-01-01")).error?.message).toBe(
      "INVALID_RANGE",
    );
    expect((await call("2028-01-01", "2028-12-31")).error).toBeNull();
    const services = await owner.rpc("report_services", {
      p_business: clasica,
      p_from: "2026-10-15",
      p_to: "2026-10-01",
    });
    expect(services.error?.message).toBe("INVALID_RANGE");
  });

  it("el dueño de otro negocio y el cliente: NO_PERMISSION", async () => {
    for (const db of [otherOwner, client]) {
      for (const fn of [
        "report_summary",
        "report_services",
        "report_commissions",
        "report_methods",
      ] as const) {
        const { error } = await db.rpc(fn, {
          p_business: clasica,
          p_from: monthStart,
          p_to: today,
        });
        expect(error?.message, fn).toBe("NO_PERMISSION");
      }
    }
  });

  it("sin cuenta no se llama ningún informe", async () => {
    const { error } = await anonClient().rpc("report_summary", {
      p_business: clasica,
      p_from: monthStart,
      p_to: today,
    });
    expect(error).not.toBeNull();
  });
});

describe("Estadísticas", () => {
  it("el dueño y el profesional ven los mismos números, que cuadran con las tablas", async () => {
    const direct = await one<{
      followers: number;
      client_bookings: number;
      visits: number;
    }>(
      `select (select count(*)::int from public.follows where business_id = $1) as followers,
              (select count(*)::int from public.bookings
               where business_id = $1 and booked_by = 'client' and status <> 'cancelled') as client_bookings,
              (select count(*)::int from public.profile_visits where business_id = $1) as visits`,
      [clasica],
    );
    expect(direct.followers).toBeGreaterThan(0);
    expect(direct.visits).toBeGreaterThan(0);
    for (const db of [owner, camilo]) {
      const { data, error } = await db.rpc("business_insights", {
        p_business: clasica,
      });
      expect(error).toBeNull();
      const [row] = data ?? [];
      expect({
        followers: Number(row.followers),
        client_bookings: Number(row.client_bookings),
        visits: Number(row.visits),
      }).toEqual(direct);
    }
  });

  it("la lista de seguidores: solo nombre y fecha, del más reciente al más antiguo", async () => {
    const { data, error } = await camilo.rpc("business_followers", {
      p_business: clasica,
    });
    expect(error).toBeNull();
    const rows = data ?? [];
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows[0]).sort()).toEqual(["followed_at", "full_name"]);
    const dates = rows.map((row) => row.followed_at);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("quien no es del equipo no ve nada", async () => {
    for (const db of [otherOwner, client]) {
      const stats = await db.rpc("business_insights", { p_business: clasica });
      expect(stats.data ?? []).toEqual([]);
      const followers = await db.rpc("business_followers", {
        p_business: clasica,
      });
      expect(followers.data ?? []).toEqual([]);
    }
    expect(
      (await anonClient().rpc("business_insights", { p_business: clasica }))
        .error,
    ).not.toBeNull();
  });

  it("la visita: sin cuenta y del cliente suma; la del equipo no; no guarda a la persona", async () => {
    const count = async () =>
      (
        await one<{ n: number }>(
          "select count(*)::int as n from public.profile_visits where business_id = $1",
          [clasica],
        )
      ).n;
    const before = await count();
    const visit = (db: Db) =>
      db.rpc("record_profile_visit", { p_business: clasica });
    expect((await visit(anonClient())).error).toBeNull();
    expect((await visit(client)).error).toBeNull();
    expect(await count()).toBe(before + 2);
    expect((await visit(owner)).error).toBeNull();
    expect((await visit(camilo)).error).toBeNull();
    expect(await count()).toBe(before + 2);
    // Un negocio que no existe no suma ni falla.
    const none = await anonClient().rpc("record_profile_visit", {
      p_business: "00000000-0000-0000-0000-000000000000",
    });
    expect(none.error).toBeNull();
    expect(await count()).toBe(before + 2);

    const columns = await sql<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'profile_visits' order by column_name`,
    );
    expect(columns.map((row) => row.column_name)).toEqual([
      "business_id",
      "id",
      "visited_at",
    ]);
  });

  it("nadie lee ni escribe las visitas sin las funciones", async () => {
    for (const db of [anonClient(), owner, client]) {
      const read = await db.from("profile_visits").select("id").limit(1);
      expect(read.data ?? []).toEqual([]);
      const write = await db
        .from("profile_visits")
        .insert({ business_id: clasica });
      expect(write.error).not.toBeNull();
    }
  });
});
