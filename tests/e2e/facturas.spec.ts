// Fase 8, facturas (US-040 a US-043, T-8.5.1): el profesional marca la llegada, hace la factura
// rápida y la ve con su comisión en sus Facturas y en las del dueño; "Generar factura" abre el pago
// ya lleno; el editor en 3 pasos, con cliente y sin cliente; editar, anular, y el total baja; sin el
// permiso, el profesional no factura (la pantalla y la base). Los pasos del editor y sus ventanas
// se miden también en los 4 tamaños (44 px y sin desplazamiento de lado). Al final, los arreglos 1 a 3
// de la revisión de las Fases 8 a 14 (Fase 15).
import {
  expect,
  type Locator,
  type Page,
  type Request,
  type Route,
  test,
} from "@playwright/test";
import { signIn as signInToDb, sql } from "../db/helpers";
import { screenProblems, signIn, visit } from "./helpers";

const OWNER = "3005550101"; // Valentina Ríos, Barbería La Clásica
const STAFF = "3005550111"; // Camilo Rojas, del mismo negocio
const NO_PERMISSION = "Tu negocio no te ha dado permiso para facturar.";
const MARK_FIRST = "Para facturar, primero marca si el cliente llegó.";
const ALREADY_INVOICED = "Esta cita ya tiene su factura.";
const NOT_OWN =
  "Esta factura tiene servicios de otro profesional. Solo el dueño la puede cambiar.";
// Corte clásico con Camilo: $25.000, y su comisión vacía es el 50 %.
const HAIRCUT = 25_000;
const HAIRCUT_COMMISSION = 12_500;

test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

/**
 * Una cita de Mateo con Camilo (Corte clásico) que empezó hace `from` minutos y acaba en `to`
 * (negativo: ya acabó). Lo que se cruce con ella en la semilla se borra.
 */
async function startedBooking(
  from: number,
  to: number,
  punctuality: number | null = null,
): Promise<string> {
  // Un solo instante para borrar e insertar: cada sql() abre su conexión y su now().
  const at = new Date().toISOString();
  const start = `$1::timestamptz - interval '${from} minutes'`;
  const end = `$1::timestamptz + interval '${to} minutes'`;
  const camilo = `s.id = %.staff_id and p.id = s.profile_id and p.phone = '+573005550111'
    and %.starts_at < ${end} and %.ends_at > ${start}`;
  await sql(
    `delete from public.bookings b using public.staff s, public.profiles p
     where ${camilo.replaceAll("%", "b")}`,
    [at],
  );
  await sql(
    `delete from public.agenda_blocks k using public.staff s, public.profiles p
     where ${camilo.replaceAll("%", "k")}`,
    [at],
  );
  const [{ id }] = await sql<{ id: string }>(
    `insert into public.bookings (business_id, staff_id, service_id, client_id, booked_by,
       starts_at, ends_at, price, punctuality, punctuality_at)
     select s.business_id, s.id, sv.id, c.id, 'client', ${start}, ${end}, sv.price,
       $2::smallint, case when $2::smallint is null then null else $1::timestamptz end
     from public.staff s
     join public.profiles p on p.id = s.profile_id
     join public.services sv on sv.business_id = s.business_id and sv.name = 'Corte clásico'
     join public.clients c on c.business_id = s.business_id
     join public.profiles cp on cp.id = c.profile_id and cp.phone = '+573005550121'
     where p.phone = '+573005550111'
     returning id`,
    [at, punctuality],
  );
  return id;
}

/** "$25.000" → 25000. */
function pesos(text: string | null): number {
  return Number((text ?? "").replace(/\D/g, ""));
}

/** El pie de Facturas: "Total ventas" y "Total comisiones" del periodo, en pesos. */
async function totals(page: Page) {
  const footer = page.locator('footer[aria-label="Totales del periodo"]');
  await expect(footer).toBeVisible();
  const value = async (label: string) =>
    pesos(
      await footer
        .locator("div", { hasText: label })
        .locator("dd")
        .textContent(),
    );
  return {
    sales: await value("Total ventas"),
    commissions: await value("Total comisiones"),
  };
}

/** Las facturas de hoy y su pie, sin otra cosa en la URL. */
async function todayTotals(page: Page) {
  await visit(page, "/pro/facturas");
  return totals(page);
}

/** La fila de la lista: "Factura 0320 · Efectivo". */
function invoiceRow(page: Page, number: string): Locator {
  return page
    .getByRole("main")
    .getByRole("link", { name: new RegExp(`^Factura ${number} · `) });
}

/** El número de cuatro cifras del aviso "Factura 0320 creada…". */
async function createdNumber(page: Page, pattern: RegExp): Promise<string> {
  const toast = page.getByText(pattern);
  await expect(toast).toBeVisible();
  return (await toast.textContent())?.match(/\d{4}/)?.[0] ?? "";
}

/** Una petición de la agenda que vuelve a pedir la página (router.refresh), no una acción. */
function isAgendaRefresh(request: Request): boolean {
  const headers = request.headers();
  return (
    request.method() === "GET" &&
    request.url().includes("/pro/agenda") &&
    headers.rsc === "1" &&
    !headers["next-router-prefetch"] &&
    !headers["next-action"]
  );
}

/**
 * Abre la agenda, espera a que se conecte al tiempo real (al suscribirse se vuelve a pedir la
 * página, useAgendaRealtime) y desde ahí retiene las recargas: la pantalla queda vieja a propósito,
 * aunque llegue un cambio. No se abortan: si una recarga falla, Next recarga la página entera.
 * Devuelve cómo soltarlas.
 */
async function visitStaleAgenda(
  page: Page,
  url: string,
): Promise<() => Promise<void>> {
  const refreshed = page.waitForResponse(
    (response) => isAgendaRefresh(response.request()),
    { timeout: 30_000 },
  );
  await visit(page, url);
  // La que ya salió trae la pantalla con el permiso: da igual cuándo termine.
  await refreshed;
  const held: Route[] = [];
  const hold = (route: Route) =>
    isAgendaRefresh(route.request()) ? held.push(route) : route.fallback();
  await page.route("**/pro/agenda**", hold);
  return async () => {
    await page.unroute("**/pro/agenda**", hold);
    await Promise.all(held.map((route) => route.fallback()));
  };
}

/** La pantalla de ahora, con lo que tenga abierto, sin nada de menos de 44 px ni de lado. */
async function expectFits(page: Page, where: string): Promise<void> {
  expect(await screenProblems(page), where).toEqual([]);
}

/** El título del paso del editor (la barra de arriba). */
function stepTitle(page: Page, name: string): Locator {
  return page.getByRole("heading", { name, exact: true });
}

test("marca la llegada, hace la factura rápida y la ve con su comisión", async ({
  page,
  browser,
}) => {
  const bookingId = await startedBooking(20, 10);
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, OWNER);
  await signIn(page, STAFF);
  const ownerBefore = await todayTotals(owner);
  const before = await todayTotals(page);

  // Sin marcar la llegada no hay botones; con "A tiempo", sí.
  await visit(page, `/pro/agenda?cita=${bookingId}`);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(MARK_FIRST)).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Factura rápida" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "A tiempo" }).click();
  await expect(dialog.getByText(MARK_FIRST)).toBeHidden();
  await expectFits(page, "la cita con los botones de factura");

  // "Generar factura" abre el pago ya lleno con la cita; se vuelve sin guardar.
  await dialog.getByRole("link", { name: "Generar factura" }).click();
  await expect(stepTitle(page, "Pago de la factura")).toBeVisible();
  const summary = page.locator("section").filter({ hasText: "Cliente" });
  await expect(summary).toContainText("Mateo Gómez");
  await expect(summary).toContainText("Cita");
  await expect(page.getByText("Corte clásico · Camilo")).toBeVisible();
  await expect(page.locator("p", { hasText: /^Total/ }).first()).toContainText(
    /\$\s?25\.000/,
  );
  await visit(page, `/pro/agenda?cita=${bookingId}`);
  await dialog.getByRole("button", { name: "Factura rápida" }).click();
  const number = await createdNumber(
    page,
    /^Factura \d{4} creada en Efectivo\.$/,
  );
  await expect(
    dialog.getByRole("link", { name: `Ver factura ${number}` }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Factura rápida" }),
  ).toHaveCount(0);

  // En las Facturas de Camilo: la fila, el pie con su comisión y el detalle.
  expect(await todayTotals(page)).toEqual({
    sales: before.sales + HAIRCUT,
    commissions: before.commissions + HAIRCUT_COMMISSION,
  });
  const row = invoiceRow(page, number);
  await expect(row).toContainText("Mateo Gómez · Corte clásico");
  await row.click();
  await expect(page).toHaveURL(/\/pro\/facturas\/[0-9a-f-]{36}$/);
  const services = page.getByRole("list", { name: "Servicios" });
  await expect(services).toContainText("comisión 50 %");
  await expect(services).toContainText(/\$\s?12\.500/);

  // En las del dueño, lo mismo.
  expect(await todayTotals(owner)).toEqual({
    sales: ownerBefore.sales + HAIRCUT,
    commissions: ownerBefore.commissions + HAIRCUT_COMMISSION,
  });
  await expect(invoiceRow(owner, number)).toContainText("Mateo Gómez");
});

test("el dueño factura en 3 pasos con cliente, la edita, la anula y el total baja", async ({
  page,
}) => {
  await signIn(page, OWNER);
  const before = await todayTotals(page);

  await page.getByRole("link", { name: "Crear una factura" }).click();
  await expect(
    page.getByRole("heading", { name: "Asocia un cliente" }),
  ).toBeVisible();
  await page.getByLabel("Buscar cliente").fill("Mateo");
  await page.getByRole("button", { name: /^Mateo Gómez/ }).click();

  await expect(
    page.getByRole("heading", { name: "Asocia servicios y productos" }),
  ).toBeVisible();
  const next = page.getByRole("button", { name: "Siguiente" });
  await expect(next).toBeDisabled();
  await page.getByRole("checkbox", { name: /^Corte clásico/ }).click();
  // El dueño elige quién lo hizo: Camilo.
  await page.getByLabel("Profesional").click();
  await page.getByRole("option", { name: /^Camilo/ }).click();
  await expectFits(page, "paso 2 con un servicio marcado");
  await next.click();

  await expect(stepTitle(page, "Pago de la factura")).toBeVisible();
  await expectFits(page, "paso 3");
  await expect(
    page.getByText("Mateo Gómez", { exact: true }).last(),
  ).toBeVisible();
  await expect(
    page.locator("p", { hasText: "Comisión del equipo" }),
  ).toContainText(/\$\s?12\.500/);
  await page.getByRole("button", { name: "Crear factura" }).click();
  const number = await createdNumber(page, /^Factura \d{4} creada\.$/);
  await expect(page).toHaveURL(/\/pro\/facturas\/[0-9a-f-]{36}$/);

  expect(await todayTotals(page)).toEqual({
    sales: before.sales + HAIRCUT,
    commissions: before.commissions + HAIRCUT_COMMISSION,
  });

  // Editar: entra al pago; en el paso 2 se cambia el valor y la comisión se vuelve a calcular.
  await invoiceRow(page, number).click();
  await page.getByRole("link", { name: "Editar factura" }).click();
  await expect(stepTitle(page, "Pago de la factura")).toBeVisible();
  await page.getByRole("button", { name: "Volver" }).click();
  await expect(stepTitle(page, "Asocia servicios y productos")).toBeVisible();
  // Como lo hace una persona: tocar, seleccionar todo y escribir (fill escribe en el mismo
  // instante del foco, antes de que el campo cambie "25.000" por "25000").
  const value = page.getByLabel("Valor");
  await value.click();
  await value.press("ControlOrMeta+a");
  await value.pressSequentially("28000");
  await expect(value).toHaveValue("28000");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(
    page.locator("p", { hasText: "Comisión del equipo" }),
  ).toContainText(/\$\s?14\.000/);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText(`Factura ${number} actualizada.`)).toBeVisible();
  await expect(page).toHaveURL(/\/pro\/facturas\/[0-9a-f-]{36}$/);
  expect(await todayTotals(page)).toEqual({
    sales: before.sales + 28_000,
    commissions: before.commissions + 14_000,
  });

  // Anular: pide confirmar, queda tachada y sale de los totales.
  await invoiceRow(page, number).click();
  await page.getByRole("button", { name: "Anular" }).click();
  const confirm = page.getByRole("alertdialog", {
    name: `¿Anular la factura ${number}?`,
  });
  await expect(confirm).toContainText(
    "Sale de los totales y no se puede deshacer.",
  );
  await expectFits(page, "confirmar anular");
  await confirm.getByRole("button", { name: "Sí, anular" }).click();
  await expect(page.getByText(`Factura ${number} anulada.`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Anular" })).toHaveCount(0);
  await expect(page.getByText(/^Anulada por Valentina el \d/)).toBeVisible();

  expect(await todayTotals(page)).toEqual(before);
  await expect(invoiceRow(page, number)).toContainText("Anulada");
});

test("el profesional factura sin cliente; salir con cambios pregunta y borra el borrador", async ({
  page,
}) => {
  await signIn(page, STAFF);
  const before = await todayTotals(page);

  await page.getByRole("link", { name: "Crear una factura" }).click();
  await page
    .getByRole("button", { name: "Continuar sin agregar cliente" })
    .click();
  const haircut = page.getByRole("checkbox", { name: /^Corte fade/ });
  await haircut.click();
  await expect(haircut).toHaveAttribute("aria-checked", "true");
  // El profesional va fijo él.
  await expect(page.getByLabel("Profesional")).toBeDisabled();

  // Con cambios, salir desde el paso 1 pregunta; cerrar la pregunta deja el borrador.
  await page.getByRole("button", { name: "Volver" }).click();
  await expect(
    page.getByRole("heading", { name: "Asocia un cliente" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Volver" }).click();
  const leave = page.getByRole("dialog", { name: "¿Salir de la factura?" });
  await expect(leave).toBeVisible();
  await expect(leave).toContainText("Lo que llevas se pierde.");
  await expectFits(page, "la pregunta al salir");
  await page.keyboard.press("Escape");
  await expect(leave).toBeHidden();
  await page
    .getByRole("button", { name: "Continuar sin agregar cliente" })
    .click();
  await expect(haircut).toHaveAttribute("aria-checked", "true");

  // "Salir" lleva a Facturas y el borrador se va: al volver, el servicio ya no está marcado.
  await page.getByRole("button", { name: "Volver" }).click();
  await page.getByRole("button", { name: "Volver" }).click();
  await leave.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/pro\/facturas$/);
  await page.getByRole("link", { name: "Crear una factura" }).click();
  await page
    .getByRole("button", { name: "Continuar sin agregar cliente" })
    .click();
  await expect(haircut).toHaveAttribute("aria-checked", "false");
  await haircut.click();
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Paso 3: sin cliente, el nombre libre; al profesional no se le muestra la comisión antes.
  await expect(stepTitle(page, "Pago de la factura")).toBeVisible();
  await expect(page.getByText("Sin cliente", { exact: true })).toBeVisible();
  await expect(page.getByText("Comisión del equipo")).toHaveCount(0);
  await page.getByLabel("Nombre del cliente (opcional)").fill("Andrés Cardona");
  await page.getByRole("button", { name: "Crear factura" }).click();
  const number = await createdNumber(page, /^Factura \d{4} creada\.$/);
  await expect(page).toHaveURL(/\/pro\/facturas\/[0-9a-f-]{36}$/);
  await expect(
    page.locator("dd", { hasText: /^Andrés Cardona$/ }),
  ).toBeVisible();

  const after = await todayTotals(page);
  expect(after.sales).toBe(before.sales + 30_000);
  expect(after.commissions).toBe(before.commissions + 15_000);
  await expect(invoiceRow(page, number)).toContainText(
    "Andrés Cardona · Corte fade",
  );
});

// Arreglo 1 de la revisión de las Fases 8 a 14.
test("la llegada corregida a No llegó no frena editar la factura de la cita", async ({
  page,
}) => {
  // Una cita que ya acabó, con la llegada marcada "A tiempo", y su factura rápida.
  const bookingId = await startedBooking(50, -20, 5);
  await signIn(page, STAFF);
  await visit(page, `/pro/agenda?cita=${bookingId}`);
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Factura rápida" }).click();
  const number = await createdNumber(
    page,
    /^Factura \d{4} creada en Efectivo\.$/,
  );

  // Después de facturar, la llegada se corrige a "No llegó".
  await sql("update public.bookings set punctuality = 1 where id = $1", [
    bookingId,
  ]);

  // Editar la factura con su misma cita guarda, sin pedir otra vez la llegada.
  await visit(page, "/pro/facturas");
  await invoiceRow(page, number).click();
  await page.getByRole("link", { name: "Editar factura" }).click();
  await expect(stepTitle(page, "Pago de la factura")).toBeVisible();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText(`Factura ${number} actualizada.`)).toBeVisible();
  await expect(page).toHaveURL(/\/pro\/facturas\/[0-9a-f-]{36}$/);
  await expect(page.getByText(MARK_FIRST)).toHaveCount(0);
});

test("sin el permiso, el profesional no factura: ni la pantalla ni la base", async ({
  page,
  browser,
}) => {
  // Una cita que ya acabó, con la llegada marcada "A tiempo".
  const bookingId = await startedBooking(50, -20, 5);
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, OWNER);
  await signIn(page, STAFF);
  try {
    // La pantalla queda vieja a propósito: se apaga el permiso después de su último pintado.
    const releaseRefresh = await visitStaleAgenda(
      page,
      `/pro/agenda?cita=${bookingId}`,
    );
    const dialog = page.getByRole("dialog");
    const quick = dialog.getByRole("button", { name: "Factura rápida" });
    await expect(quick).toBeEnabled();

    // El dueño apaga el permiso con la cita abierta en el celular de Camilo.
    await visit(owner, "/pro/configurar/permisos");
    await owner.getByRole("switch", { name: /^Facturar/ }).click();
    await expect(owner.getByText("Facturar: apagado")).toBeVisible();

    // La base no lo deja: save_invoice con la sesión de Camilo responde sin permiso.
    const camilo = (await signInToDb("+573005550111")).client;
    const [seed] = await sql<{
      business: string;
      method: string;
      service: string;
      staff: string;
      price: number;
    }>(
      `select b.business_id as business, b.service_id as service, b.staff_id as staff,
              b.price, (select pm.id from public.payment_methods pm
                        where pm.business_id = b.business_id and pm.is_active
                        order by pm.position limit 1) as method
       from public.bookings b where b.id = $1`,
      [bookingId],
    );
    const { error } = await camilo.rpc("save_invoice", {
      p_business: seed.business,
      p_method: seed.method,
      p_items: [
        { service_id: seed.service, staff_id: seed.staff, price: seed.price },
      ],
      p_booking: bookingId,
    });
    expect(error?.message).toBe("NO_PERMISSION_INVOICING");

    // En la pantalla, la acción tampoco la crea, y los botones se van.
    await quick.click();
    await expect(page.getByText(NO_PERMISSION)).toBeVisible();
    await releaseRefresh();
    await expect(quick).toHaveCount(0);
    const [{ invoices }] = await sql<{ invoices: number }>(
      "select count(*)::int as invoices from public.invoices where booking_id = $1",
      [bookingId],
    );
    expect(invoices).toBe(0);

    // El + de Facturas avisa, y el editor no abre.
    await visit(page, "/pro/facturas");
    await page.getByRole("button", { name: "Crear una factura" }).click();
    await expect(page.getByText(NO_PERMISSION)).toBeVisible();
    await visit(page, "/pro/facturas/nueva");
    await expect(page.getByText(NO_PERMISSION)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Crear factura" }),
    ).toHaveCount(0);
  } finally {
    await sql(
      `update public.team_permissions tp set invoicing = true
       from public.staff s join public.profiles p on p.id = s.profile_id
       where s.business_id = tp.business_id and p.phone = '+573005550101'`,
    );
  }
});

// Arreglo 2 de la revisión de las Fases 8 a 14.
test("la cita que el dueño facturó con servicios de otro: el profesional ve el aviso, sin botones", async ({
  page,
}) => {
  // Una cita de Camilo que ya acabó, marcada "A tiempo".
  const bookingId = await startedBooking(50, -20, 5);
  // El dueño la factura solo con un servicio de Julián: Camilo no ve esa factura (RLS).
  const owner = (await signInToDb("+573005550101")).client;
  const [seed] = await sql<{
    business: string;
    method: string;
    service: string;
    julian: string;
  }>(
    `select b.business_id as business, b.service_id as service,
            (select s.id from public.staff s join public.profiles p on p.id = s.profile_id
             where s.business_id = b.business_id and p.phone = '+573005550112') as julian,
            (select pm.id from public.payment_methods pm
             where pm.business_id = b.business_id and pm.is_active
             order by pm.position limit 1) as method
     from public.bookings b where b.id = $1`,
    [bookingId],
  );
  const { error } = await owner.rpc("save_invoice", {
    p_business: seed.business,
    p_method: seed.method,
    p_items: [
      { service_id: seed.service, staff_id: seed.julian, price: HAIRCUT },
    ],
    p_booking: bookingId,
  });
  expect(error).toBeNull();

  await signIn(page, STAFF);
  await visit(page, `/pro/agenda?cita=${bookingId}`);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(ALREADY_INVOICED)).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "Generar factura" }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Factura rápida" }),
  ).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: /^Ver factura/ })).toHaveCount(
    0,
  );
  await expectFits(page, "la cita con el aviso de ya facturada");

  // El editor con ?cita= tampoco abre, y no ofrece "Ver factura".
  await visit(page, `/pro/facturas/nueva?cita=${bookingId}`);
  await expect(page.getByText(ALREADY_INVOICED)).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver factura" })).toHaveCount(0);
  await expect(stepTitle(page, "Pago de la factura")).toHaveCount(0);
});

// Arreglo 3 de la revisión de las Fases 8 a 14.
test("con un servicio de otro en $ 0, el profesional no ve Editar ni Anular", async ({
  page,
}) => {
  // Valentina factura a Camilo un Corte clásico y a Julián otro en $ 0.
  const owner = (await signInToDb("+573005550101")).client;
  const [seed] = await sql<{
    business: string;
    method: string;
    service: string;
    camilo: string;
    julian: string;
  }>(
    `select s.business_id as business, s.id as camilo,
            (select sv.id from public.services sv
             where sv.business_id = s.business_id and sv.name = 'Corte clásico') as service,
            (select pm.id from public.payment_methods pm
             where pm.business_id = s.business_id and pm.name = 'Efectivo') as method,
            (select j.id from public.staff j join public.profiles jp on jp.id = j.profile_id
             where j.business_id = s.business_id and j.is_active
               and jp.phone = '+573005550112') as julian
     from public.staff s join public.profiles p on p.id = s.profile_id
     where p.phone = '+573005550111' and s.is_active`,
  );
  const { data: invoiceId, error } = await owner.rpc("save_invoice", {
    p_business: seed.business,
    p_method: seed.method,
    p_items: [
      { service_id: seed.service, staff_id: seed.camilo, price: HAIRCUT },
      { service_id: seed.service, staff_id: seed.julian, price: 0 },
    ],
  });
  expect(error).toBeNull();

  // Camilo ve solo su servicio; la suma es el total, pero la factura no es toda suya.
  await signIn(page, STAFF);
  await visit(page, `/pro/facturas/${invoiceId}`);
  await expect(page.getByRole("list", { name: "Servicios" })).toContainText(
    "Corte clásico",
  );
  await expect(page.getByRole("link", { name: "Editar factura" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Anular" })).toHaveCount(0);

  // Y el editor dice por qué no.
  await visit(page, `/pro/facturas/${invoiceId}/editar`);
  await expect(page.getByText(NOT_OWN)).toBeVisible();
});
