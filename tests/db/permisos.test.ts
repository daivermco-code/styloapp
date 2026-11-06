// Suite de permisos del cierre del MVP (T-6.5.3, US-035: cada lado ve solo lo suyo). Lo que las
// fases anteriores probaron por partes, aquí de una vez: todas las tablas con RLS, ninguna función
// de la semilla ni de uso interno se puede llamar desde el navegador, y la llave de servicio no
// está en el código que baja al navegador. Necesitan `npm run db:start` y `.env.local`; la última
// necesita además `npm run build` (busca en `.next/static`).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { anonClient, sql } from "./helpers";

// Las que solo llaman otras funciones o los disparadores (Tech Spec y migraciones 0001 a 0004).
const INTERNAL = [
  "booking_notify",
  "booking_reminders",
  "booking_time_text",
  "booking_when_text",
  "client_booking_rules",
  "client_own_booking",
  "client_service_terms",
  "invoice_can_write",
  "new_link_code",
  "send_sms_demo",
  "staff_commission",
];

// Las tablas que a propósito no tienen políticas: solo se leen y escriben con sus funciones
// (0005: las visitas al perfil, invariante 13).
const WITHOUT_POLICIES = ["profile_visits"];

// Las de la oleada 5 que se llaman con cuenta (informes y Estadísticas, US-059). Sin cuenta solo
// se cuenta una visita.
const REPORTS = [
  "report_guard",
  "report_summary",
  "report_services",
  "report_commissions",
  "report_methods",
  "business_insights",
  "business_followers",
];

// Las de la oleada 4 que el navegador llama con cuenta: sin cuenta, ninguna (US-051).
const MONEY = [
  "save_invoice",
  "void_invoice",
  "booking_is_invoiced",
  "invoice_all_mine",
  "payroll",
  "pay_staff",
  "client_stats",
  "staff_commissions",
];

/** Las funciones de public con ese nombre o que empiezan por `seed_demo`, con su firma. */
async function functionsToLock(): Promise<string[]> {
  const rows = await sql<{ signature: string }>(
    `select p.oid::regprocedure::text as signature
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (p.proname like 'seed\\_demo%' or p.proname = 'reset_demo'
            or p.proname = 'create_demo_person' or p.proname = any($1))`,
    [INTERNAL],
  );
  return rows.map((row) => row.signature);
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe("cada lado ve solo lo suyo", () => {
  it("todas las tablas de public tienen RLS y al menos una política, salvo las de sus funciones", async () => {
    const withoutRls = await sql(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity`,
    );
    expect(withoutRls).toEqual([]);
    const withoutPolicy = await sql(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p')
         and not exists (select 1 from pg_policies p
                         where p.schemaname = 'public' and p.tablename = c.relname)
       order by c.relname`,
    );
    expect(withoutPolicy.map((row) => row.relname)).toEqual(WITHOUT_POLICIES);
    // Y esas no tienen ningún permiso para el navegador.
    const grants = await sql(
      `select table_name, grantee, privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and table_name = any($1)
         and grantee in ('anon', 'authenticated')`,
      [WITHOUT_POLICIES],
    );
    expect(grants).toEqual([]);
  });

  it("la semilla, el reinicio y las funciones internas no se llaman desde el navegador", async () => {
    const functions = await functionsToLock();
    // Que la lista no quede vacía si cambia un nombre: la semilla tiene varias.
    expect(functions.length).toBeGreaterThan(INTERNAL.length);
    for (const fn of functions) {
      for (const role of ["anon", "authenticated"]) {
        const [row] = await sql<{ allowed: boolean }>(
          "select has_function_privilege($1, $2, 'execute') as allowed",
          [role, fn],
        );
        expect(row.allowed, `${role} → ${fn}`).toBe(false);
      }
    }
    const { error } = await anonClient().rpc("seed_demo");
    expect(error).not.toBeNull();
  });

  it("sin cuenta no se llama ninguna función del dinero", async () => {
    const rows = await sql<{ signature: string; allowed: boolean }>(
      `select p.oid::regprocedure::text as signature,
              has_function_privilege('anon', p.oid, 'execute') as allowed
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = any($1)`,
      [MONEY],
    );
    expect(rows).toHaveLength(MONEY.length);
    for (const row of rows) {
      expect(row.allowed, row.signature).toBe(false);
    }
  });

  it("sin cuenta no se llama ningún informe ni Estadísticas: solo se cuenta una visita", async () => {
    const rows = await sql<{
      name: string;
      anon: boolean;
      authenticated: boolean;
    }>(
      `select p.proname as name,
              has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as authenticated
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = any($1)
       order by p.proname`,
      [[...REPORTS, "record_profile_visit"]],
    );
    expect(rows.map((row) => row.name).sort()).toEqual(
      [...REPORTS, "record_profile_visit"].sort(),
    );
    for (const row of rows) {
      expect(row.anon, row.name).toBe(row.name === "record_profile_visit");
      expect(row.authenticated, row.name).toBe(true);
    }
  });

  it("sin cuenta no se reserva, no se cancela ni se califica", async () => {
    const anon = anonClient();
    const zero = "00000000-0000-0000-0000-000000000000";
    const book = await anon.rpc("client_book", {
      p_service: zero,
      p_staff: zero,
      p_starts_at: new Date().toISOString(),
    });
    expect(book.error).not.toBeNull();
    const cancel = await anon.rpc("client_cancel", { p_booking: zero });
    expect(cancel.error).not.toBeNull();
    const review = await anon.from("reviews").insert({
      booking_id: zero,
      business_id: zero,
      staff_id: zero,
      attention: 5,
      quality: 5,
    });
    expect(review.error).not.toBeNull();
  });

  it.skipIf(!existsSync(".next/static"))(
    "la llave de servicio no está en el código del navegador",
    () => {
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      expect(key).toBeTruthy();
      const leaks = filesUnder(".next/static").filter((file) => {
        const text = readFileSync(file, "utf8");
        return text.includes(key ?? "") || text.includes("SERVICE_ROLE");
      });
      expect(leaks).toEqual([]);
    },
  );
});
