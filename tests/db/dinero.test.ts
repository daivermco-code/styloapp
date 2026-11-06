// Pruebas de la Fase 7 contra el Supabase local (T-7.2.1, US-051 parte de base): las reglas de
// save_invoice en el orden del Tech Spec (O4.2) y quién puede llamarla, void_invoice con lo ya
// pagado, pay_staff (cuadra con los ítems y pide marcar antes), los guardias de los métodos de
// pago, la RLS de las 5 tablas nuevas por rol y la semilla del dinero. Necesitan
// `npm run db:start` y `.env.local`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Json } from "@/shared/types/database";
import { anonClient, type Db, resetDemo, signIn, sql } from "./helpers";

const OWNER = "+573005550101"; // Valentina Ríos, Barbería La Clásica
const OTHER_OWNER = "+573005550102"; // Andrés Castillo, Uñas y Arte Spa
const CAMILO = "+573005550111";
const JULIAN = "+573005550112";
const SOFIA = "+573005550113";
const CLIENT = "+573005550121"; // Mateo Gómez, cliente con cuenta

type Item = { service_id: string; staff_id: string; price: Json };

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

const serviceIdOf = async (business: string, name: string) =>
  (
    await one<{ id: string }>(
      "select id from public.services where business_id = $1 and name = $2",
      [business, name],
    )
  ).id;

const methodIdOf = async (business: string, name: string) =>
  (
    await one<{ id: string }>(
      "select id from public.payment_methods where business_id = $1 and name = $2",
      [business, name],
    )
  ).id;

let clasica: string;
let unas: string;
let owner: Db;
let camilo: Db;
let ids: { camilo: string; julian: string; sofia: string; owner: string };
let efectivo: string;
let corte: string;
let limpieza: string;

/** Llama a save_invoice con lo mínimo; cada prueba cambia lo que necesita. */
function saveInvoice(
  client: Db,
  input: {
    invoice?: string;
    business?: string;
    client?: string;
    guest?: string;
    booking?: string;
    method?: string;
    items: Json;
  },
) {
  return client.rpc("save_invoice", {
    p_business: input.business ?? clasica,
    p_method: input.method ?? efectivo,
    p_items: input.items,
    p_invoice: input.invoice,
    p_client: input.client,
    p_guest_name: input.guest,
    p_booking: input.booking,
  });
}

const item = (staff: string, price = 25000, service = corte): Item => ({
  service_id: service,
  staff_id: staff,
  price,
});

beforeAll(async () => {
  await resetDemo();
  clasica = (
    await one<{ id: string }>(
      "select id from public.businesses where slug = 'barberia-la-clasica'",
    )
  ).id;
  unas = (
    await one<{ id: string }>(
      "select id from public.businesses where slug = 'unas-y-arte-spa'",
    )
  ).id;
  ids = {
    camilo: await staffIdOf(CAMILO),
    julian: await staffIdOf(JULIAN),
    sofia: await staffIdOf(SOFIA),
    owner: await staffIdOf(OWNER),
  };
  efectivo = await methodIdOf(clasica, "Efectivo");
  corte = await serviceIdOf(clasica, "Corte clásico");
  limpieza = await serviceIdOf(clasica, "Limpieza facial");
  owner = (await signIn(OWNER)).client;
  camilo = (await signIn(CAMILO)).client;
});
afterAll(resetDemo);

describe("la semilla del dinero", () => {
  it("cada negocio nace con Efectivo y Banco", async () => {
    const rows = await sql<{ n: number }>(
      `select count(*)::int as n from public.businesses b
       where (select count(*) from public.payment_methods pm
              where pm.business_id = b.id and pm.name in ('Efectivo', 'Banco')) <> 2`,
    );
    expect(rows[0].n).toBe(0);
  });

  it("Sofía tiene 40 % y su precio propio; Camilo, dos citas sin marcar", async () => {
    const sofia = await one<{ price: number; pct: string }>(
      "select price, commission_pct::text as pct from public.staff_services where staff_id = $1 and service_id = $2",
      [ids.sofia, limpieza],
    );
    expect(sofia).toEqual({ price: 50000, pct: "40.00" });
    const { n } = await one<{ n: number }>(
      `select count(*)::int as n from public.bookings
       where staff_id = $1 and status = 'pending' and starts_at <= now()`,
      [ids.camilo],
    );
    expect(n).toBe(2);
  });

  // La oleada 5 suma los meses de antes (seed_demo_reports): sus gastos no caen en el mes de hoy
  // y sus pagos son "Comisiones del mes".
  it("hay facturas, una anulada, un pago que cuadra, cinco gastos, un bloqueado y una serie quincenal", async () => {
    const counts = await one<Record<string, number>>(
      `select (select count(*)::int from public.invoices where business_id = $1) as invoices,
              (select count(*)::int from public.invoices where business_id = $1 and status = 'void') as voided,
              (select count(*)::int from public.expenses where business_id = $1
               and paid_on >= date_trunc('month', (now() at time zone 'America/Bogota')::date)) as expenses,
              (select count(*)::int from public.clients where business_id = $1 and is_blocked) as blocked,
              (select count(*)::int from public.recurring_bookings
               where business_id = $1 and frequency = 'biweekly') as biweekly`,
      [clasica],
    );
    expect(counts.invoices).toBeGreaterThan(10);
    expect(counts.voided).toBe(1);
    expect(counts.expenses).toBe(5);
    expect(counts.blocked).toBe(1);
    expect(counts.biweekly).toBe(1);

    const payments = await sql<{ amount: number; covered: number }>(
      `select sp.amount, (select sum(ii.commission)::int from public.invoice_items ii
                          where ii.staff_payment_id = sp.id) as covered
       from public.staff_payments sp
       where sp.business_id = $1 and sp.note = 'Comisiones de la semana'`,
      [clasica],
    );
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(payments[0].covered);
  });

  it("las facturas copian la comisión de cada profesional", async () => {
    const rows = await sql<{ staff_id: string; pct: string }>(
      "select distinct staff_id, commission_pct::text as pct from public.invoice_items where business_id = $1",
      [clasica],
    );
    for (const row of rows) {
      expect(row.pct).toBe(row.staff_id === ids.sofia ? "40.00" : "50.00");
    }
  });
});

describe("save_invoice: quién puede", () => {
  it("sin cuenta no factura", async () => {
    const { error } = await saveInvoice(anonClient(), {
      items: [item(ids.camilo)],
    });
    expect(error).not.toBeNull();
  });

  it("el dueño factura servicios de cualquiera, con la comisión de cada uno", async () => {
    const before = await one<{ n: number }>(
      "select coalesce(max(number), 0)::int as n from public.invoices where business_id = $1",
      [clasica],
    );
    const { data: id, error } = await saveInvoice(owner, {
      guest: "Rodrigo",
      items: [item(ids.camilo, 25000), item(ids.sofia, 45000, limpieza)],
    });
    expect(error).toBeNull();
    const invoice = await one<{
      number: number;
      total: number;
      status: string;
      guest_name: string;
    }>(
      "select number, total, status::text, guest_name from public.invoices where id = $1",
      [id],
    );
    expect(invoice).toEqual({
      number: before.n + 1,
      total: 70000,
      status: "paid",
      guest_name: "Rodrigo",
    });
    const items = await sql<{ staff_id: string; commission: number }>(
      "select staff_id, commission from public.invoice_items where invoice_id = $1 order by position",
      [id],
    );
    expect(items).toEqual([
      { staff_id: ids.camilo, commission: 12500 },
      { staff_id: ids.sofia, commission: 18000 },
    ]);
  });

  it("el profesional con permiso factura solo lo suyo", async () => {
    const mine = await saveInvoice(camilo, { items: [item(ids.camilo)] });
    expect(mine.error).toBeNull();
    const other = await saveInvoice(camilo, {
      items: [item(ids.camilo), item(ids.julian)],
    });
    expect(other.error?.message).toBe("NOT_OWN_ITEMS");
  });

  it("sin el permiso de facturación, el profesional no factura", async () => {
    await sql(
      "update public.team_permissions set invoicing = false where business_id = $1",
      [clasica],
    );
    try {
      const { error } = await saveInvoice(camilo, {
        items: [item(ids.camilo)],
      });
      expect(error?.message).toBe("NO_PERMISSION_INVOICING");
    } finally {
      await sql(
        "update public.team_permissions set invoicing = true where business_id = $1",
        [clasica],
      );
    }
  });

  it("el dueño de otro negocio no factura aquí", async () => {
    const other = (await signIn(OTHER_OWNER)).client;
    const { error } = await saveInvoice(other, { items: [item(ids.camilo)] });
    expect(error?.message).toBe("NO_PERMISSION_INVOICING");
  });
});

describe("save_invoice: la cita, los datos y los ítems", () => {
  it("la cita tiene que tener la llegada marcada y no estar facturada", async () => {
    const unmarked = await one<{ id: string }>(
      `select id from public.bookings
       where staff_id = $1 and status = 'pending' and starts_at <= now() limit 1`,
      [ids.camilo],
    );
    const notMarked = await saveInvoice(owner, {
      booking: unmarked.id,
      items: [item(ids.camilo)],
    });
    expect(notMarked.error?.message).toBe("BOOKING_NOT_MARKED");

    const invoiced = await one<{ booking_id: string }>(
      "select booking_id from public.invoices where business_id = $1 and status = 'paid' and booking_id is not null limit 1",
      [clasica],
    );
    const again = await saveInvoice(owner, {
      booking: invoiced.booking_id,
      items: [item(ids.camilo)],
    });
    expect(again.error?.message).toBe("ALREADY_INVOICED");
  });

  it("la cita de la factura anulada se puede volver a facturar", async () => {
    const voided = await one<{
      booking_id: string;
      staff_id: string;
      service_id: string;
    }>(
      `select i.booking_id, b.staff_id, b.service_id from public.invoices i
       join public.bookings b on b.id = i.booking_id
       where i.business_id = $1 and i.status = 'void'`,
      [clasica],
    );
    const { error } = await saveInvoice(owner, {
      booking: voided.booking_id,
      items: [item(voided.staff_id, 20000, voided.service_id)],
    });
    expect(error).toBeNull();
  });

  it("revisa el cliente, el método, la cantidad de ítems, los precios y el catálogo", async () => {
    const otherClient = await one<{ id: string }>(
      "select id from public.clients where business_id = $1 limit 1",
      [unas],
    );
    const client = await saveInvoice(owner, {
      client: otherClient.id,
      items: [item(ids.camilo)],
    });
    expect(client.error?.message).toBe("NOT_FOUND");
    expect(client.error?.details).toBe("client");

    await sql(
      "insert into public.payment_methods (business_id, name, is_active) values ($1, 'Nequi', false)",
      [clasica],
    );
    const inactive = await saveInvoice(owner, {
      method: await methodIdOf(clasica, "Nequi"),
      items: [item(ids.camilo)],
    });
    expect(inactive.error?.message).toBe("METHOD_INACTIVE");

    const none = await saveInvoice(owner, { items: [] });
    expect(none.error?.message).toBe("ITEMS_COUNT");
    const many = await saveInvoice(owner, {
      items: Array.from({ length: 21 }, () => item(ids.camilo)),
    });
    expect(many.error?.message).toBe("ITEMS_COUNT");

    for (const price of [-1, 1000.5, "25000"]) {
      const bad = await saveInvoice(owner, {
        items: [{ ...item(ids.camilo), price }],
      });
      expect(bad.error?.message, String(price)).toBe("INVALID_ITEMS");
    }

    const foreignService = await one<{ id: string }>(
      "select id from public.services where business_id = $1 limit 1",
      [unas],
    );
    const service = await saveInvoice(owner, {
      items: [item(ids.camilo, 1000, foreignService.id)],
    });
    expect(service.error?.details).toBe("service");
  });
});

describe("editar y anular", () => {
  it("el dueño edita: cambian los ítems y el total", async () => {
    const { data: id } = await saveInvoice(owner, {
      items: [item(ids.camilo, 25000)],
    });
    const { error } = await saveInvoice(owner, {
      invoice: id as string,
      items: [item(ids.julian, 30000), item(ids.julian, 15000)],
    });
    expect(error).toBeNull();
    const row = await one<{ total: number; items: number }>(
      `select total, (select count(*)::int from public.invoice_items where invoice_id = $1) as items
       from public.invoices where id = $1`,
      [id],
    );
    expect(row).toEqual({ total: 45000, items: 2 });
  });

  it("el profesional no anula una factura con servicios de otro", async () => {
    const { data: id } = await saveInvoice(owner, {
      items: [item(ids.camilo), item(ids.sofia, 45000, limpieza)],
    });
    const { error } = await camilo.rpc("void_invoice", {
      p_invoice: id as string,
    });
    expect(error?.message).toBe("NOT_OWN_ITEMS");
  });

  it("anulada ya no se edita; con algo pagado no se edita ni se anula", async () => {
    const { data: id } = await saveInvoice(owner, {
      items: [item(ids.camilo)],
    });
    expect(
      (await owner.rpc("void_invoice", { p_invoice: id as string })).error,
    ).toBeNull();
    const edit = await saveInvoice(owner, {
      invoice: id as string,
      items: [item(ids.camilo)],
    });
    expect(edit.error?.message).toBe("INVOICE_VOID");

    const paid = await one<{ id: string }>(
      `select distinct i.id from public.invoices i join public.invoice_items ii on ii.invoice_id = i.id
       where i.business_id = $1 and ii.staff_payment_id is not null limit 1`,
      [clasica],
    );
    const editPaid = await saveInvoice(owner, {
      invoice: paid.id,
      items: [item(ids.julian)],
    });
    expect(editPaid.error?.message).toBe("INVOICE_PAID_OUT");
    const voidPaid = await owner.rpc("void_invoice", { p_invoice: paid.id });
    expect(voidPaid.error?.message).toBe("INVOICE_PAID_OUT");
  });

  // Arreglo 3 de la revisión (0006).
  it("invoice_all_mine dice si todos los servicios son de quien llama, aunque el ajeno sea de $ 0", async () => {
    const { data: mine } = await saveInvoice(owner, {
      items: [item(ids.camilo)],
    });
    const { data: zero } = await saveInvoice(owner, {
      items: [item(ids.camilo), item(ids.julian, 0)],
    });
    const ask = (client: Db, invoice: unknown) =>
      client.rpc("invoice_all_mine", { p_invoice: invoice as string });

    expect((await ask(camilo, mine)).data).toBe(true);
    // Camilo solo ve su servicio, y el ajeno de $ 0 no cambia la suma: la base dice que no.
    const seen = await camilo
      .from("invoice_items")
      .select("price")
      .eq("invoice_id", zero as string);
    expect(seen.data).toHaveLength(1);
    expect((await ask(camilo, zero)).data).toBe(false);
    // Quien no tiene servicios en ella, y el dueño de otro negocio, tampoco.
    const julian = (await signIn(JULIAN)).client;
    expect((await ask(julian, mine)).data).toBe(false);
    const other = (await signIn(OTHER_OWNER)).client;
    expect((await ask(other, mine)).data).toBe(false);
    // Sin cuenta no se llama.
    expect((await ask(anonClient(), mine)).error).not.toBeNull();
    // Y la base sigue sin dejarlo anular.
    const { error } = await camilo.rpc("void_invoice", {
      p_invoice: zero as string,
    });
    expect(error?.message).toBe("NOT_OWN_ITEMS");
  });

  // Arreglo 1 de la revisión (0006).
  it("con la llegada corregida a No llegó, se edita con la misma cita; otra sin marcar, no", async () => {
    const paid = await one<{ id: string; booking_id: string }>(
      `select i.id, i.booking_id from public.invoices i
       join public.bookings b on b.id = i.booking_id
       where i.business_id = $1 and i.status = 'paid' and b.staff_id = $2
         and b.punctuality in (3, 5)
         and not exists (select 1 from public.invoice_items ii
                         where ii.invoice_id = i.id and ii.staff_payment_id is not null)
       limit 1`,
      [clasica, ids.sofia],
    );
    const { error: markError } = await owner
      .from("bookings")
      .update({ punctuality: 1 })
      .eq("id", paid.booking_id);
    expect(markError).toBeNull();

    const edit = await saveInvoice(owner, {
      invoice: paid.id,
      booking: paid.booking_id,
      items: [item(ids.sofia, 45000, limpieza)],
    });
    expect(edit.error).toBeNull();
    const row = await one<{ total: number; booking_id: string }>(
      "select total, booking_id from public.invoices where id = $1",
      [paid.id],
    );
    expect(row).toEqual({ total: 45000, booking_id: paid.booking_id });

    // Crear otra factura con esa cita, o pasar esta a una cita sin marcar, sí pide la llegada.
    const create = await saveInvoice(owner, {
      booking: paid.booking_id,
      items: [item(ids.sofia, 45000, limpieza)],
    });
    expect(create.error?.message).toBe("BOOKING_NOT_MARKED");
    const unmarked = await one<{ id: string }>(
      `select id from public.bookings
       where staff_id = $1 and status = 'pending' and starts_at <= now() limit 1`,
      [ids.camilo],
    );
    const moved = await saveInvoice(owner, {
      invoice: paid.id,
      booking: unmarked.id,
      items: [item(ids.camilo)],
    });
    expect(moved.error?.message).toBe("BOOKING_NOT_MARKED");
  });

  it("nadie escribe facturas, ítems ni pagos sin las funciones", async () => {
    const invoice = await one<{ id: string }>(
      "select id from public.invoices where business_id = $1 limit 1",
      [clasica],
    );
    const insert = await owner.from("invoices").insert({
      business_id: clasica,
      number: 9999,
      payment_method_id: efectivo,
      issued_on: "2026-11-01",
      total: 1,
    });
    expect(insert.error?.code).toBe("42501");
    const update = await owner
      .from("invoice_items")
      .update({ price: 1 })
      .eq("invoice_id", invoice.id);
    expect(update.error?.code).toBe("42501");
    const payment = await owner.from("staff_payments").insert({
      business_id: clasica,
      staff_id: ids.camilo,
      amount: 1,
      payment_method_id: efectivo,
      paid_on: "2026-11-01",
    });
    expect(payment.error?.code).toBe("42501");
  });
});

describe("liquidador y pagos", () => {
  it("lo pendiente de cada profesional es la suma de sus ítems sin pago", async () => {
    const { data, error } = await owner.rpc("payroll", { p_business: clasica });
    expect(error).toBeNull();
    const rows = data as {
      staff_id: string;
      pending: number;
      unmarked: number;
    }[];
    expect(rows.map((row) => row.staff_id)).not.toContain(ids.owner);
    for (const row of rows) {
      const { sum } = await one<{ sum: number }>(
        `select coalesce(sum(ii.commission), 0)::int as sum from public.invoice_items ii
         join public.invoices i on i.id = ii.invoice_id and i.status = 'paid'
         where ii.staff_id = $1 and ii.staff_payment_id is null`,
        [row.staff_id],
      );
      expect(Number(row.pending)).toBe(sum);
    }
    expect(
      Number(rows.find((row) => row.staff_id === ids.camilo)?.unmarked),
    ).toBe(2);
  });

  it("el profesional no ve el liquidador ni paga", async () => {
    const { data } = await camilo.rpc("payroll", { p_business: clasica });
    expect(data).toEqual([]);
    const { error } = await camilo.rpc("pay_staff", {
      p_business: clasica,
      p_staff: ids.camilo,
      p_method: efectivo,
      p_day: "2026-11-01",
    });
    expect(error?.message).toBe("NO_PERMISSION");
  });

  it("con citas sin marcar no se paga; al marcarlas sí, y el valor sale de la base", async () => {
    const today = (
      await one<{ d: string }>(
        "select to_char((now() at time zone 'America/Bogota')::date, 'YYYY-MM-DD') as d",
      )
    ).d;
    const pay = () =>
      owner.rpc("pay_staff", {
        p_business: clasica,
        p_staff: ids.camilo,
        p_method: efectivo,
        p_day: today,
        p_note: "Prueba",
      });

    const blocked = await pay();
    expect(blocked.error?.message).toBe("UNMARKED_BOOKINGS");
    expect(blocked.error?.details).toBe("2");

    const { error: markError } = await owner
      .from("bookings")
      .update({ punctuality: 5 })
      .eq("staff_id", ids.camilo)
      .eq("status", "pending")
      .lte("starts_at", new Date().toISOString());
    expect(markError).toBeNull();

    const { sum } = await one<{ sum: number }>(
      `select sum(ii.commission)::int as sum from public.invoice_items ii
       join public.invoices i on i.id = ii.invoice_id and i.status = 'paid'
       where ii.staff_id = $1 and ii.staff_payment_id is null`,
      [ids.camilo],
    );
    const { data: paymentId, error } = await pay();
    expect(error).toBeNull();
    const payment = await one<{ amount: number }>(
      "select amount from public.staff_payments where id = $1",
      [paymentId],
    );
    expect(payment.amount).toBe(sum);

    const again = await pay();
    expect(again.error?.message).toBe("NOTHING_PENDING");
  });

  it("no paga con fecha futura", async () => {
    const { error } = await owner.rpc("pay_staff", {
      p_business: clasica,
      p_staff: ids.sofia,
      p_method: efectivo,
      p_day: "2999-01-01",
    });
    expect(error?.message).toBe("INVALID_DATE");
  });
  // Arreglo 4 de la revisión (0006): un inactivo con solo líneas de $ 0 no se queda en el liquidador;
  // si tiene algo con comisión, se cuentan y se pagan también las de $ 0 (lo que lista el detalle).
  it("el inactivo con solo comisiones de $ 0 sale del liquidador; con algo más, se pagan juntas", async () => {
    const today = (
      await one<{ d: string }>(
        "select to_char((now() at time zone 'America/Bogota')::date, 'YYYY-MM-DD') as d",
      )
    ).d;
    const payJulian = () =>
      owner.rpc("pay_staff", {
        p_business: clasica,
        p_staff: ids.julian,
        p_method: efectivo,
        p_day: today,
      });
    const julianRow = async () => {
      const { data, error } = await owner.rpc("payroll", {
        p_business: clasica,
      });
      expect(error).toBeNull();
      const row = (
        data as {
          staff_id: string;
          pending: number;
          items: number;
          invoices: number;
        }[]
      ).find((r) => r.staff_id === ids.julian);
      return (
        row && {
          pending: Number(row.pending),
          items: Number(row.items),
          invoices: Number(row.invoices),
        }
      );
    };

    // Sus citas de hoy que ya empezaron, marcadas: si no, pay_staff pide marcarlas antes.
    const marked = await owner
      .from("bookings")
      .update({ punctuality: 5 })
      .eq("staff_id", ids.julian)
      .eq("status", "pending")
      .lte("starts_at", new Date().toISOString());
    expect(marked.error).toBeNull();

    // Julián queda sin nada pendiente y después le facturan un servicio de $ 0.
    expect((await payJulian()).error).toBeNull();
    expect(
      (await saveInvoice(owner, { items: [item(ids.julian, 0)] })).error,
    ).toBeNull();
    await sql("update public.staff set is_active = false where id = $1", [
      ids.julian,
    ]);
    try {
      expect(await julianRow()).toBeUndefined();
      expect((await payJulian()).error?.message).toBe("NOTHING_PENDING");

      // Con un servicio con comisión vuelve: cuenta las dos líneas y las dos facturas, y pay_staff
      // se lleva también la de $ 0.
      expect(
        (await saveInvoice(owner, { items: [item(ids.julian, 20000)] })).error,
      ).toBeNull();
      expect(await julianRow()).toEqual({
        pending: 10000,
        items: 2,
        invoices: 2,
      });
      const { data: paymentId, error } = await payJulian();
      expect(error).toBeNull();
      const covered = await one<{ n: number; amount: number }>(
        `select count(*)::int as n,
                (select amount from public.staff_payments where id = $1) as amount
         from public.invoice_items where staff_payment_id = $1`,
        [paymentId],
      );
      expect(covered).toEqual({ n: 2, amount: 10000 });
      expect(await julianRow()).toBeUndefined();
    } finally {
      await sql("update public.staff set is_active = true where id = $1", [
        ids.julian,
      ]);
    }
  });
});

describe("métodos de pago", () => {
  it("no se quita el último activo ni se borra uno en uso, y el nombre no se repite", async () => {
    const banco = await methodIdOf(clasica, "Banco");
    expect(
      (
        await owner
          .from("payment_methods")
          .update({ is_active: false })
          .eq("id", banco)
      ).error,
    ).toBeNull();
    const last = await owner
      .from("payment_methods")
      .update({ is_active: false })
      .eq("id", efectivo);
    expect(last.error?.message).toBe("LAST_ACTIVE_METHOD");
    await owner
      .from("payment_methods")
      .update({ is_active: true })
      .eq("id", banco);

    const used = await owner
      .from("payment_methods")
      .delete()
      .eq("id", efectivo);
    expect(used.error?.code).toBe("23503");
    const repeated = await owner
      .from("payment_methods")
      .insert({ business_id: clasica, name: "Banco" });
    expect(repeated.error?.code).toBe("23505");
  });

  it("el profesional los lee pero no los cambia", async () => {
    const { data } = await camilo
      .from("payment_methods")
      .select("id")
      .eq("business_id", clasica);
    expect((data ?? []).length).toBeGreaterThanOrEqual(2);
    const { error } = await camilo
      .from("payment_methods")
      .insert({ business_id: clasica, name: "Daviplata" });
    expect(error?.code).toBe("42501");
  });
});

describe("cada lado ve solo lo suyo", () => {
  const TABLES = [
    "invoices",
    "invoice_items",
    "expenses",
    "staff_payments",
    "payment_methods",
  ] as const;

  it("el profesional ve solo sus facturas e ítems, y nada de gastos ni pagos", async () => {
    const { data: items } = await camilo
      .from("invoice_items")
      .select("staff_id");
    expect((items ?? []).length).toBeGreaterThan(0);
    expect(new Set((items ?? []).map((row) => row.staff_id))).toEqual(
      new Set([ids.camilo]),
    );

    const { data: invoices } = await camilo.from("invoices").select("id");
    const { n } = await one<{ n: number }>(
      `select count(distinct i.id)::int as n from public.invoices i
       join public.invoice_items ii on ii.invoice_id = i.id where ii.staff_id = $1`,
      [ids.camilo],
    );
    expect(invoices).toHaveLength(n);

    expect((await camilo.from("expenses").select("id")).data).toEqual([]);
    expect((await camilo.from("staff_payments").select("id")).data).toEqual([]);

    // Gastos (US-044, solo el dueño): tampoco los escribe. La RLS frena el insert y deja en 0
    // filas el update y el delete; la tabla queda igual.
    const before = await one<{ n: number; total: number }>(
      "select count(*)::int as n, coalesce(sum(amount), 0)::int as total from public.expenses where business_id = $1",
      [clasica],
    );
    const insert = await camilo.from("expenses").insert({
      business_id: clasica,
      name: "Gasto de Camilo",
      category: "other",
      paid_on: "2026-11-01",
      amount: 1000,
    });
    expect(insert.error?.code).toBe("42501");
    const update = await camilo
      .from("expenses")
      .update({ amount: 1 })
      .eq("business_id", clasica)
      .select("id");
    expect(update.data ?? []).toEqual([]);
    const remove = await camilo
      .from("expenses")
      .delete()
      .eq("business_id", clasica)
      .select("id");
    expect(remove.data ?? []).toEqual([]);
    expect(
      await one(
        "select count(*)::int as n, coalesce(sum(amount), 0)::int as total from public.expenses where business_id = $1",
        [clasica],
      ),
    ).toEqual(before);
    expect(
      (await camilo.rpc("client_stats", { p_business: clasica })).data,
    ).toEqual([]);
  });

  it("el dueño ve todo lo de su negocio", async () => {
    const { data } = await owner
      .from("invoices")
      .select("id")
      .eq("business_id", clasica);
    const { n } = await one<{ n: number }>(
      "select count(*)::int as n from public.invoices where business_id = $1",
      [clasica],
    );
    expect(data).toHaveLength(n);
    expect(
      (
        (await owner.rpc("client_stats", { p_business: clasica }))
          .data as unknown[]
      ).length,
    ).toBeGreaterThan(0);
    const counters = (await owner.rpc("home_counters", { p_business: clasica }))
      .data?.[0];
    const paid = await one<{ n: number }>(
      "select count(*)::int as n from public.invoices where business_id = $1 and status = 'paid'",
      [clasica],
    );
    expect(Number(counters?.invoices)).toBe(paid.n);
  });

  it("el cliente y quien no tiene cuenta no ven nada", async () => {
    const client = (await signIn(CLIENT)).client;
    for (const table of TABLES) {
      expect((await client.from(table).select("id")).data, table).toEqual([]);
      const anon = await anonClient().from(table).select("id");
      expect(anon.data ?? [], table).toEqual([]);
    }
  });
});

describe("precio y comisión de cada profesional (US-037)", () => {
  it("la comisión no se lee por la API; el dueño la ve con staff_commissions", async () => {
    const asAnon = await anonClient()
      .from("staff_services")
      .select("commission_pct")
      .eq("staff_id", ids.sofia);
    expect(asAnon.error?.code).toBe("42501");
    const asStaff = await camilo
      .from("staff_services")
      .select("commission_pct")
      .eq("staff_id", ids.sofia);
    expect(asStaff.error?.code).toBe("42501");
    // El precio y la duración sí se leen sin cuenta (la app de clientes los usa).
    const prices = await anonClient()
      .from("staff_services")
      .select("service_id, price, duration_minutes")
      .eq("staff_id", ids.sofia);
    expect(prices.error).toBeNull();

    const { data } = await owner.rpc("staff_commissions", {
      p_staff: ids.sofia,
    });
    expect(
      data?.find((row) => row.service_id === limpieza)?.commission_pct,
    ).toBe(40);
    const ofCamilo = await camilo.rpc("staff_commissions", {
      p_staff: ids.sofia,
    });
    expect(ofCamilo.data).toEqual([]);
  });

  it("el profesional no quita un servicio con precio o comisión del dueño", async () => {
    const sofia = (await signIn(SOFIA)).client;
    const blocked = await sofia
      .from("staff_services")
      .delete()
      .eq("staff_id", ids.sofia)
      .eq("service_id", limpieza);
    expect(blocked.error?.message).toBe("OWNER_PRICING");
    const kept = await one<{ pct: string }>(
      "select commission_pct::text as pct from public.staff_services where staff_id = $1 and service_id = $2",
      [ids.sofia, limpieza],
    );
    expect(kept.pct).toBe("40.00");

    // Uno sin precio ni comisión propios sí se quita (Camilo), y el dueño quita cualquiera.
    const plain = await one<{ service_id: string }>(
      `select service_id from public.staff_services
       where staff_id = $1 and price is null and commission_pct is null limit 1`,
      [ids.camilo],
    );
    const own = await camilo
      .from("staff_services")
      .delete()
      .eq("staff_id", ids.camilo)
      .eq("service_id", plain.service_id);
    expect(own.error).toBeNull();
    const byOwner = await owner
      .from("staff_services")
      .delete()
      .eq("staff_id", ids.sofia)
      .eq("service_id", limpieza);
    expect(byOwner.error).toBeNull();
  });
});

// Arreglo 2 de la revisión (0006).
describe("booking_is_invoiced (0006, revisión punto 2)", () => {
  it("le dice al profesional que su cita ya está facturada aunque no vea la factura, y a nadie más", async () => {
    const { id: booking } = await one<{ id: string }>(
      `select b.id from public.bookings b
       where b.staff_id = $1 and b.punctuality in (3, 5)
         and not exists (select 1 from public.invoices i where i.booking_id = b.id)
       order by b.starts_at desc limit 1`,
      [ids.camilo],
    );
    const ask = (client: Db) =>
      client.rpc("booking_is_invoiced", { p_booking: booking });
    expect((await ask(camilo)).data).toBe(false);

    // El dueño la factura solo con un servicio de Julián: RLS le esconde la factura a Camilo.
    const { data: invoiceId, error } = await saveInvoice(owner, {
      booking,
      items: [item(ids.julian)],
    });
    expect(error).toBeNull();
    const seen = await camilo
      .from("invoices")
      .select("id")
      .eq("booking_id", booking);
    expect(seen.data).toEqual([]);
    expect((await ask(camilo)).data).toBe(true);
    expect((await ask(owner)).data).toBe(true);
    const again = await saveInvoice(camilo, {
      booking,
      items: [item(ids.camilo)],
    });
    expect(again.error?.message).toBe("ALREADY_INVOICED");

    // Quien no ve la cita no sabe nada: otro profesional (aunque vea la factura) y otro dueño.
    for (const phone of [JULIAN, OTHER_OWNER]) {
      const { client } = await signIn(phone);
      expect((await ask(client)).data, phone).toBe(false);
    }
    expect((await ask(anonClient())).error).not.toBeNull();

    // Anulada ya no cuenta: se puede volver a facturar.
    const voided = await owner.rpc("void_invoice", {
      p_invoice: invoiceId as string,
    });
    expect(voided.error).toBeNull();
    expect((await ask(camilo)).data).toBe(false);
  });
});
