// Flujo E2E 1 (Blueprint T-1.5.5): entrar con el código leído de la bandeja, en los tres lados,
// con los errores de US-003 y la bandeja sin sesión de US-004. También cambiar de persona sin
// cerrar sesión: mientras se entra, la bandeja trae los códigos de quien entra.
import { expect, type Page, test } from "@playwright/test";
import { sql } from "../db/helpers";
import {
  CODE_TEXT,
  readCodeFromInbox,
  requestCodeFor,
  signIn,
  typeCode,
  visit,
} from "./helpers";

const PERSONAS = [
  {
    side: "Negocio",
    name: "Valentina Ríos",
    digits: "3005550101",
    home: /\/pro$/,
    landmark: (page: Page) =>
      page.getByRole("main").getByText("Valentina Ríos"),
  },
  {
    side: "Profesional",
    name: "Laura Méndez",
    digits: "3005550114",
    home: /\/pro\/vincularme$/,
    landmark: (page: Page) =>
      page.getByRole("heading", { name: "Vincularme a un negocio" }),
  },
  {
    side: "Cliente",
    name: "Mateo Gómez",
    digits: "3005550121",
    home: /\/app$/,
    landmark: (page: Page) => page.getByRole("main").getByText("Mateo Gómez"),
  },
] as const;

// Cada proyecto (navegador y tamaño) empieza con la demo como nueva.
test.beforeAll(async () => {
  await sql("select public.reset_demo()");
});

for (const persona of PERSONAS) {
  test(`${persona.side}: entra desde el inicio con el código de la bandeja`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: new RegExp(`^${persona.side}`) })
      .click();
    await page.getByRole("link", { name: new RegExp(persona.name) }).click();

    await expect(page).toHaveURL(/\/entrar\?persona=/);
    await expect(page.getByLabel("Celular")).toHaveValue(persona.digits);
    await page.getByRole("button", { name: "Enviar código" }).click();

    await expect(page).toHaveURL(/\/entrar\/codigo$/);
    // El aviso tipo SMS baja con el código y el botón de la bandeja lo cuenta sin leer.
    await expect(page.getByText(CODE_TEXT).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Bandeja de la demo, 1 sin leer" }),
    ).toBeVisible();

    const code = await readCodeFromInbox(page);
    await typeCode(page, code);
    await page.getByRole("button", { name: "Enviar", exact: true }).click();

    await expect(page).toHaveURL(persona.home);
    await expect(persona.landmark(page)).toBeVisible();

    // En el inicio del negocio, "Cerrar sesión" está en el perfil, al tocar el saludo.
    if (persona.side === "Negocio") {
      await page.getByRole("link", { name: /Ver mi perfil$/ }).click();
      await expect(page).toHaveURL(/\/pro\/perfil$/);
    }
    // En la app de clientes está en el Menú; desde 1024 px, en el menú lateral.
    const menu = page.getByRole("button", { name: "Menú" });
    if (persona.side === "Cliente" && (await menu.isVisible())) {
      await menu.click();
    }
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(
      page.getByRole("heading", { name: "¿Con quién entras?" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
}

test("celular inválido, código errado, código vencido y pedir uno nuevo", async ({
  page,
}) => {
  await page.goto("/entrar");
  await page.getByLabel("Celular").fill("12345");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(
    page.getByText("Escribe un celular colombiano de 10 dígitos."),
  ).toBeVisible();

  await requestCodeFor(page, "3005550122");
  const code = await readCodeFromInbox(page);
  const wrong = code.slice(0, 5) + String((Number(code[5]) + 1) % 10);

  await typeCode(page, wrong);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText(
      "Ese código no coincide. Míralo en la bandeja y vuelve a intentarlo.",
    ),
  ).toBeVisible();

  // Envejece el mensaje: más de 10 minutos es "venció", aunque el código sea el correcto.
  await sql(
    "update public.demo_messages set created_at = created_at - interval '11 minutes' where recipient_phone = $1 and kind = 'login_code'",
    ["+573005550122"],
  );
  // El error sale antes de que las casillas vuelvan a activarse. Sin el foco en una casilla, WebKit
  // toma la tecla de borrar como "Atrás" y vuelve a /entrar.
  const last = page.getByRole("textbox", { name: "Número 6 del código" });
  await expect(last).toBeEnabled();
  await last.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("Backspace");
  await typeCode(page, code);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Ese código ya venció. Pide uno nuevo."),
  ).toBeVisible();

  // Supabase deja pedir un código por celular cada segundo; más rápido responde "Espera un momento".
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: /Pedir uno nuevo/ }).click();
  const fresh = await readCodeFromInbox(page, code);
  await typeCode(page, fresh);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("main").getByText("Daniela Ruiz")).toBeVisible();
});

test("persona nueva: completa el perfil y vuelve a la página que pedía", async ({
  page,
}) => {
  // Sin sesión y sin nadie entrando, la bandeja está vacía.
  await page.goto("/bandeja");
  await expect(page.getByText("Todavía no te ha llegado nada.")).toBeVisible();
  await page.goto("/entrar?siguiente=/bandeja");

  await requestCodeFor(page, "3005550188");
  const code = await readCodeFromInbox(page);
  await typeCode(page, code);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();

  await expect(page).toHaveURL(/\/entrar\/perfil\?siguiente=%2Fbandeja$/);
  await page.getByRole("button", { name: "Guardar y seguir" }).click();
  await expect(page.getByText("Escribe tu nombre.")).toBeVisible();

  await page.getByLabel("Nombre y apellido").fill("Lucía Prieto");
  await page.getByRole("button", { name: "Guardar y seguir" }).click();

  // En /bandeja, con sesión, está el código con el que entró.
  await expect(page).toHaveURL(/\/bandeja$/);
  await expect(page.getByText("Lucía Prieto · Cliente")).toBeVisible();
  await expect(page.getByText(CODE_TEXT).first()).toBeVisible();
});

test("con otra persona adentro, la bandeja de la entrada trae el código de quien entra", async ({
  page,
}) => {
  await signIn(page, "3005550121"); // Mateo
  await visit(page, "/entrar");
  await requestCodeFor(page, "3005550111"); // Camilo
  const [{ body }] = await sql<{ body: string }>(
    `select body from public.demo_messages
     where recipient_phone = '+573005550111' and kind = 'login_code'
     order by created_at desc limit 1`,
  );
  const code = await readCodeFromInbox(page);
  expect(body).toContain(code);
  await typeCode(page, code);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page).toHaveURL(/\/pro$/);
  await expect(
    page.getByRole("link", { name: "Hola, Camilo Rojas. Ver mi perfil" }),
  ).toBeVisible();
});
