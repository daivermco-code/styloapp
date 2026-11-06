// Fase 6, cierre de US-034 (T-6.5.1): cada pantalla, en los 4 tamaños y los 2 navegadores (los 8
// proyectos), sin desplazamiento de lado (la grilla de la agenda se desplaza dentro de su caja, no
// la página) y con todo lo que se toca de 44 × 44 px o más. Se salvan los enlaces dentro de un
// texto (WCAG 2.5.8) y las piezas de Leaflet, que dibuja el mapa a su medida. Fase 9 (T-9.4.1):
// Gastos, el liquidador con su hoja e Historial de pagos. Fase 10 (T-10.3.1): Clientes con su ficha
// y su editor, Usuarios bloqueados y Agendas recurrentes.
import { expect, type Page, test } from "@playwright/test";
import { sql } from "../db/helpers";
import {
  readCodeFromInbox,
  requestCodeFor,
  screenProblems,
  signIn,
  visit,
} from "./helpers";

const OWNER = "3005550101"; // Valentina Ríos, Barbería La Clásica
const STAFF = "3005550111"; // Camilo Rojas
const FREE_STAFF = "3005550114"; // Laura Méndez, sin negocio
const MATEO = "3005550121";
const DANIELA = "3005550122"; // tiene una cita efectiva sin calificar en la semilla
const NEW_PERSON = "3005550188";
const SLUG = "barberia-la-clasica";

test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

/** Recorre las direcciones y junta lo que falla en cada una, para verlo todo de una vez. */
async function checkScreens(page: Page, urls: string[]): Promise<void> {
  const report: string[] = [];
  for (const url of urls) {
    await visit(page, url);
    await page.waitForLoadState("networkidle");
    for (const problem of await screenProblems(page)) {
      report.push(`${url}: ${problem.what} (${problem.size})`);
    }
  }
  expect(report).toEqual([]);
}

async function businessIds() {
  const [row] = await sql<{
    business: string;
    service: string;
    staff: string;
  }>(
    `select b.id as business,
            (select id from public.services where business_id = b.id order by name limit 1) as service,
            (select s.id from public.staff s join public.profiles p on p.id = s.profile_id
             where p.phone = '+573005550111') as staff
     from public.businesses b where b.slug = $1`,
    [SLUG],
  );
  return row;
}

/** Una factura pagada con un servicio de Camilo y una cita suya marcada sin facturar. */
async function invoiceIds() {
  const [row] = await sql<{ invoice: string; booking: string | null }>(
    `select (select i.id from public.invoices i
             join public.invoice_items ii on ii.invoice_id = i.id
             where i.status = 'paid' and ii.staff_id = s.id
             order by i.number desc limit 1) as invoice,
            (select b.id from public.bookings b
             where b.staff_id = s.id and b.punctuality in (3, 5)
               and not exists (select 1 from public.invoices i
                               where i.booking_id = b.id and i.status = 'paid')
             order by b.starts_at desc limit 1) as booking
     from public.staff s join public.profiles p on p.id = s.profile_id
     where p.phone = '+573005550111'`,
  );
  return row;
}

/** Facturas, su detalle, el editor nuevo y al editar, y la cita con sus botones. */
async function invoiceScreens(): Promise<string[]> {
  const { invoice, booking } = await invoiceIds();
  return [
    "/pro/facturas",
    "/pro/facturas?periodo=mes",
    "/pro/facturas/nueva",
    `/pro/facturas/${invoice}`,
    `/pro/facturas/${invoice}/editar`,
    ...(booking
      ? [`/pro/agenda?cita=${booking}`, `/pro/facturas/nueva?cita=${booking}`]
      : []),
  ];
}

test("sin cuenta: inicio, entrada, bandeja, explorar y enlace", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { business } = await businessIds();
  await checkScreens(page, [
    "/",
    "/entrar",
    "/bandeja",
    "/app",
    "/app/negocios",
    `/app/negocio/${business}`,
    "/app/sin-sesion",
    "/app/mapa",
    "/app/ofertas",
    `/n/${SLUG}`,
    "/n/no-existe-este-negocio",
  ]);
});

test("entrada con código y persona nueva", async ({ page }) => {
  await visit(page, "/entrar");
  await requestCodeFor(page, NEW_PERSON);
  expect(await screenProblems(page)).toEqual([]);
  const code = await readCodeFromInbox(page);
  const first = page.getByRole("textbox", { name: "Número 1 del código" });
  await first.focus();
  await page.keyboard.type(code);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page).toHaveURL(/\/entrar\/perfil/);
  expect(await screenProblems(page)).toEqual([]);
});

test("cliente: todas sus pantallas", async ({ page }) => {
  test.setTimeout(240_000);
  const { business, service } = await businessIds();
  await signIn(page, MATEO);
  await checkScreens(page, [
    "/app",
    "/app/negocios",
    `/app/negocio/${business}`,
    "/app/reservas",
    "/app/perfil",
    "/app/seguidos",
    "/app/resenas",
    "/app/reputacion",
    "/app/mapa",
    "/app/ofertas",
    `/n/${SLUG}?servicio=${service}`,
  ]);
});

test("cliente: calificar", async ({ page }) => {
  const [{ id }] = await sql<{ id: string }>(
    `select b.id from public.bookings b
     join public.clients c on c.id = b.client_id
     join public.profiles p on p.id = c.profile_id
     where p.phone = '+573005550122' and b.status = 'successful'
       and not exists (select 1 from public.reviews r where r.booking_id = b.id)
     limit 1`,
  );
  await signIn(page, DANIELA);
  await checkScreens(page, [`/app/calificar/${id}`]);
});

test("dueño: inicio, agenda, servicios, configurar y facturas", async ({
  page,
}) => {
  test.setTimeout(400_000);
  const { service, staff } = await businessIds();
  await signIn(page, OWNER);
  await checkScreens(page, [
    "/pro",
    "/pro/agenda",
    "/pro/agenda/nueva",
    "/pro/servicios",
    `/pro/servicios/${service}`,
    "/pro/configurar",
    "/pro/configurar/negocio",
    "/pro/configurar/horario",
    "/pro/configurar/funciones",
    "/pro/configurar/equipo",
    `/pro/configurar/equipo/${staff}`,
    `/pro/configurar/equipo/${staff}?pestana=precio`,
    "/pro/configurar/permisos",
    "/pro/configurar/metodos-de-pago",
    "/pro/configurar/cuenta",
    "/pro/perfil",
    ...(await invoiceScreens()),
  ]);
});

/** Un gasto y el pago a Julián de la semilla. */
async function moneyIds() {
  const [row] = await sql<{ expense: string; payment: string }>(
    `select (select e.id from public.expenses e where e.business_id = b.id limit 1) as expense,
            (select sp.id from public.staff_payments sp where sp.business_id = b.id limit 1)
              as payment
     from public.businesses b where b.slug = $1`,
    [SLUG],
  );
  return row;
}

test("dueño: gastos, liquidador e historial de pagos", async ({ page }) => {
  test.setTimeout(240_000);
  const { staff } = await businessIds();
  const { expense, payment } = await moneyIds();
  await signIn(page, OWNER);
  await checkScreens(page, [
    "/pro/gastos",
    "/pro/gastos?periodo=dia",
    "/pro/gastos/nuevo",
    `/pro/gastos/${expense}`,
    "/pro/liquidador",
    `/pro/liquidador?pro=${staff}`,
    "/pro/pagos",
    `/pro/pagos/${payment}`,
  ]);
});

/** El id de un cliente de la semilla, por su nombre. */
async function clientIdFor(name: string): Promise<string> {
  const [row] = await sql<{ id: string }>(
    `select c.id from public.clients c join public.businesses b on b.id = c.business_id
     where b.slug = $1 and c.full_name = $2`,
    [SLUG, name],
  );
  return row.id;
}

test("dueño: clientes, ficha, editor, bloqueados y recurrentes", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const client = await clientIdFor("Luis Bermúdez");
  await signIn(page, OWNER);
  await checkScreens(page, [
    "/pro/clientes",
    "/pro/clientes?pestana=mejores",
    "/pro/clientes?pestana=no-vuelven",
    "/pro/clientes?pestana=sin-visitas",
    "/pro/clientes?cumple=1",
    "/pro/clientes/nuevo",
    `/pro/clientes/${client}`,
    `/pro/clientes/${client}?pestana=facturas`,
    `/pro/clientes/${client}/editar`,
    "/pro/configurar/bloqueados",
    "/pro/configurar/recurrentes",
  ]);
});

// Informes (Fase 13, T-13.3.1): las 4 pestañas, con un rango y con un profesional, y la hoja del
// rango abierta. Estadísticas (Fase 14, T-14.2.1) va con ellas.
const REPORT_SCREENS = [
  "/pro/informes",
  "/pro/informes?periodo=mes",
  "/pro/informes?pestana=ventas&periodo=mes",
  "/pro/informes?pestana=comisiones&periodo=mes",
  "/pro/estadisticas",
];

test("dueño: informes y estadísticas", async ({ page }) => {
  test.setTimeout(240_000);
  const { staff } = await businessIds();
  await signIn(page, OWNER);
  await checkScreens(page, [
    ...REPORT_SCREENS,
    "/pro/informes?pestana=metodos&periodo=mes",
    "/pro/informes?periodo=dia&dia=2026-10-15&desde=2026-10-01&hasta=2026-10-15",
    `/pro/informes?periodo=mes&pro=${staff}`,
  ]);
  await page.getByRole("button", { name: "Filtrar: Rango" }).click();
  await expect(
    page.getByRole("dialog", { name: "Filtrar: Rango" }),
  ).toBeVisible();
  expect(await screenProblems(page)).toEqual([]);
});

test("profesional: inicio, agenda, perfil, cuenta, facturas, informes y estadísticas", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await signIn(page, STAFF);
  await checkScreens(page, [
    "/pro",
    "/pro/agenda",
    "/pro/perfil",
    "/pro/configurar/cuenta",
    ...(await invoiceScreens()),
    ...REPORT_SCREENS,
  ]);
});

test("profesional sin negocio: vincularme", async ({ page }) => {
  await signIn(page, FREE_STAFF);
  await expect(page).toHaveURL(/\/pro\/vincularme$/);
  expect(await screenProblems(page)).toEqual([]);
});
