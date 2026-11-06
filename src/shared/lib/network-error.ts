// Reconoce cuándo una Server Action falló por falta de internet (Fase 11, T-11.2.1).

/** Lo que dicen los navegadores cuando un pedido no sale: Chrome, Safari y Firefox. */
const NETWORK_MESSAGE =
  /failed to fetch|load failed|networkerror|network request failed/i;

export const OFFLINE_TITLE = "Sin conexión";
export const OFFLINE_NOT_SAVED =
  "No se guardó nada. Lo que escribiste sigue aquí: vuelve a intentarlo cuando haya internet.";

/**
 * true si el error es de la red: el navegador está sin conexión, o el pedido no salió (un TypeError de
 * fetch). Cualquier otro error es de la app y no se confunde con este.
 */
export function isNetworkError(error: unknown, online: boolean): boolean {
  if (!online) return true;
  return error instanceof TypeError && NETWORK_MESSAGE.test(error.message);
}
