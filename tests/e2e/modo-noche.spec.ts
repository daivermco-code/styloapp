// Fase 16, modo día y noche (T-16.3.1): la app sigue el modo claro u oscuro del sistema, sin botón.
// El fondo y el texto cambian al pasar el sistema a oscuro sin recargar, la barra del sistema tiene el
// color de cada modo, y en oscuro las pantallas principales de los tres lados no se salen de lado ni
// dejan nada pequeño para tocar. Con CAPTURAS=1 guarda cada pantalla en capturas/fase-16/<proyecto>/.
import { expect, type Page, test } from "@playwright/test";
import { sql } from "../db/helpers";
import { screenProblems, signIn, visit } from "./helpers";

const OWNER = "3005550101"; // Valentina Ríos, Barbería La Clásica
const STAFF = "3005550111"; // Camilo Rojas
const MATEO = "3005550121";
const SLUG = "barberia-la-clasica";

// De DESIGN.md §2 y §2.1: el fondo y el texto de cada modo.
const DAY = { background: "rgb(237, 248, 245)", text: "rgb(77, 86, 84)" };
const NIGHT = { background: "rgb(14, 23, 22)", text: "rgb(230, 239, 237)" };

test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

async function colorsOf(page: Page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.body);
    return { background: style.backgroundColor, text: style.color };
  });
}

test("el fondo y el texto siguen el modo del sistema sin recargar", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await visit(page, "/app");
  await expect.poll(() => colorsOf(page)).toEqual(DAY);

  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => colorsOf(page)).toEqual(NIGHT);

  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => colorsOf(page)).toEqual(DAY);
});

test("la barra del sistema y los campos nativos tienen el color de cada modo", async ({
  page,
}) => {
  await visit(page, "/");
  await expect(
    page.locator(
      'meta[name="theme-color"][media="(prefers-color-scheme: light)"]',
    ),
  ).toHaveAttribute("content", "#0E7C74");
  await expect(
    page.locator(
      'meta[name="theme-color"][media="(prefers-color-scheme: dark)"]',
    ),
  ).toHaveAttribute("content", "#183A36");
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
    "content",
    "light dark",
  );
  // Las fechas, horas y listas nativas se pintan en el modo del sistema.
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    ),
  ).toBe("light dark");
});

test.describe("en oscuro", () => {
  test.use({ colorScheme: "dark" });

  /** Revisa cada pantalla en oscuro y, con CAPTURAS=1, la guarda. */
  async function checkDark(
    page: Page,
    side: string,
    screens: Record<string, string>,
  ): Promise<void> {
    const report: string[] = [];
    for (const [name, url] of Object.entries(screens)) {
      await visit(page, url);
      await page.waitForLoadState("networkidle");
      expect(await colorsOf(page)).toEqual(NIGHT);
      for (const problem of await screenProblems(page)) {
        report.push(`${url}: ${problem.what} (${problem.size})`);
      }
      if (process.env.CAPTURAS) {
        await page.screenshot({
          path: `capturas/fase-16/${test.info().project.name}/${side}-${name}.png`,
          fullPage: true,
        });
      }
    }
    expect(report).toEqual([]);
  }

  async function ids() {
    const [row] = await sql<{
      business: string;
      invoice: string;
      client: string;
      booking: string;
    }>(
      `select b.id as business,
              (select i.id from public.invoices i where i.business_id = b.id and i.status = 'paid'
               order by i.number desc limit 1) as invoice,
              (select c.id from public.clients c where c.business_id = b.id
               and c.full_name = 'Luis Bermúdez') as client,
              (select k.id from public.bookings k where k.business_id = b.id
               and k.starts_at::date = (now() at time zone 'America/Bogota')::date
               order by k.starts_at limit 1) as booking
       from public.businesses b where b.slug = $1`,
      [SLUG],
    );
    return row;
  }

  test("sin cuenta: inicio, entrada, bandeja, explorar y enlace", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const { business } = await ids();
    await checkDark(page, "publico", {
      inicio: "/",
      entrar: "/entrar",
      bandeja: "/bandeja",
      explorar: "/app",
      negocio: `/app/negocio/${business}`,
      mapa: "/app/mapa",
      ofertas: "/app/ofertas",
      enlace: `/n/${SLUG}`,
    });
  });

  test("cliente: reservas, perfil, reputación y reseñas", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, MATEO);
    await checkDark(page, "cliente", {
      reservas: "/app/reservas",
      perfil: "/app/perfil",
      reputacion: "/app/reputacion",
      resenas: "/app/resenas",
    });
  });

  test("dueño: agenda, facturas, dinero, clientes e informes", async ({
    page,
  }) => {
    test.setTimeout(400_000);
    const { invoice, client, booking } = await ids();
    await signIn(page, OWNER);
    await checkDark(page, "duenio", {
      inicio: "/pro",
      agenda: "/pro/agenda",
      ...(booking ? { "agenda-cita": `/pro/agenda?cita=${booking}` } : {}),
      "agenda-nueva": "/pro/agenda/nueva",
      servicios: "/pro/servicios",
      configurar: "/pro/configurar",
      horario: "/pro/configurar/horario",
      equipo: "/pro/configurar/equipo",
      facturas: "/pro/facturas?periodo=mes",
      factura: `/pro/facturas/${invoice}`,
      "factura-nueva": "/pro/facturas/nueva",
      gastos: "/pro/gastos",
      liquidador: "/pro/liquidador",
      clientes: "/pro/clientes",
      ficha: `/pro/clientes/${client}`,
      informes: "/pro/informes?periodo=mes",
      "informes-ventas": "/pro/informes?pestana=ventas&periodo=mes",
      estadisticas: "/pro/estadisticas",
    });
  });

  test("profesional: inicio, agenda y cuenta", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, STAFF);
    await checkDark(page, "profesional", {
      inicio: "/pro",
      agenda: "/pro/agenda",
      cuenta: "/pro/configurar/cuenta",
    });
  });
});
