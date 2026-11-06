// Ayudas de las pruebas E2E: entrar con el código que llega a la bandeja de la demo.
import { expect, type Page } from "@playwright/test";

export const CODE_TEXT = /Tu código para entrar a StyloApp es \d{6}\./;

/**
 * Abre la bandeja de la demo, lee el código más nuevo y la cierra. Con `previous`, espera a que la
 * lista se recargue con uno distinto.
 */
export async function readCodeFromInbox(
  page: Page,
  previous?: string,
): Promise<string> {
  await page.getByRole("button", { name: /^Bandeja de la demo/ }).click();
  const inbox = page.getByRole("dialog", { name: "Bandeja de la demo" });
  const message = inbox.getByText(CODE_TEXT).first();
  await expect(message).toBeVisible();
  if (previous) await expect(message).not.toContainText(previous);
  const code = (await message.textContent())?.match(/\d{6}/)?.[0];
  if (!code) throw new Error("La bandeja no trae el código");
  await page.keyboard.press("Escape");
  await expect(inbox).toBeHidden();
  return code;
}

/** Escribe el código en las casillas desde la primera, cuando ya se puede (no está pidiendo uno). */
export async function typeCode(page: Page, code: string): Promise<void> {
  const first = page.getByRole("textbox", { name: "Número 1 del código" });
  await expect(first).toBeEnabled();
  await first.focus();
  await page.keyboard.type(code);
}

export async function requestCodeFor(
  page: Page,
  digits: string,
): Promise<void> {
  await page.getByLabel("Celular").fill(digits);
  await expect(page.getByLabel("Celular")).toHaveValue(digits);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page).toHaveURL(/\/entrar\/codigo/);
}

/**
 * Ir a una dirección. El inicio y la agenda se recargan solos al conectarse al tiempo real, y en
 * WebKit esa recarga cuenta como navegación y corta la ida: se repite.
 */
export async function visit(page: Page, url: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(url);
      return;
    } catch (error) {
      if (attempt === 3 || !String(error).includes("interrupted")) throw error;
    }
  }
}

/** Entra con ese celular (10 dígitos) por /entrar y espera a salir de la entrada. */
export async function signIn(page: Page, digits: string): Promise<void> {
  await visit(page, "/entrar");
  await requestCodeFor(page, digits);
  const code = await readCodeFromInbox(page);
  await typeCode(page, code);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
}

/** Elige una hora en una de las listas del editor de horario. */
export async function pickTime(
  page: Page,
  label: string,
  time: string,
): Promise<void> {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: time, exact: true }).click();
  await expect(page.getByRole("combobox", { name: label })).toHaveText(time);
}

const MIN_TARGET = 44;

export interface Problem {
  what: string;
  size: string;
}

/** Lo que se sale de lado y lo que se toca con menos de 44 × 44 en la pantalla de ahora. */
async function problemsOnScreen(page: Page): Promise<Problem[]> {
  return page.evaluate((min) => {
    const found: { what: string; size: string }[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth + 1) {
      found.push({
        what: "la página se desplaza de lado",
        size: `${root.scrollWidth} > ${root.clientWidth}`,
      });
    }
    const selector = [
      "a[href]",
      "button",
      "input:not([type=hidden])",
      "select",
      "textarea",
      "[role=button]",
      "[role=tab]",
      "[role=switch]",
      "[role=checkbox]",
      "[role=radio]",
      "[role=combobox]",
    ].join(",");
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      // El mapa, lo escondido y las citas de la grilla, que miden lo que duran.
      if (
        element.closest(
          ".leaflet-container, [aria-hidden=true], [data-time-block]",
        )
      ) {
        continue;
      }
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.opacity === "0") continue;
      const box = element.getBoundingClientRect();
      // Sin caja o recortada para lectores de pantalla (sr-only).
      if (box.width <= 1 || box.height <= 1) continue;
      if (element.tagName === "A" && style.display === "inline") continue;
      // Una casilla dentro de su etiqueta: se toca toda la fila, que es la que debe medir 44.
      const label = element.closest("label")?.getBoundingClientRect();
      if (label && label.width >= min && label.height >= min) continue;
      if (box.width < min || box.height < min) {
        const name =
          element.getAttribute("aria-label") ??
          element.textContent?.trim().slice(0, 40) ??
          "";
        found.push({
          what: `${element.tagName.toLowerCase()} "${name}"`,
          size: `${Math.round(box.width)} × ${Math.round(box.height)}`,
        });
      }
    }
    return found;
  }, MIN_TARGET);
}

/**
 * Lo que falla en la pantalla de ahora (T-6.5.1): desplazamiento de lado y lo que se toca con menos
 * de 44 × 44. Antes espera a que acaben las animaciones: las ventanas abren con un zoom desde
 * 95 % y, medidas a mitad, los botones dan 43 px.
 */
export async function screenProblems(page: Page): Promise<Problem[]> {
  await page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        // Las que no acaban (animate-spin, animate-pulse) colgarían la espera.
        .filter(
          (animation) => animation.effect?.getTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished),
    ),
  );
  return problemsOnScreen(page);
}
