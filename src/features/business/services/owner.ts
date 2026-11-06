import "server-only";
import { getCurrentPerson } from "@/features/auth/services/queries";
import {
  type ActionError,
  AppErrorCode,
} from "@/shared/types/action-result";

export const SIGN_IN_AGAIN = "Vuelve a entrar con tu celular.";
export const OWNER_ONLY = "Solo el dueño del negocio puede cambiar esto.";
export const NOT_SAVED = "No se guardaron los cambios. Inténtalo de nuevo.";

/**
 * Para las Server Actions del dueño: su negocio, o el error para devolver. Va aparte de los
 * archivos "use server" para que no quede expuesta como una acción más.
 */
export async function ownerBusinessId(): Promise<
  { ok: true; businessId: string } | { ok: false; error: ActionError }
> {
  const person = await getCurrentPerson();
  if (!person) {
    return {
      ok: false,
      error: { code: AppErrorCode.UNAUTHORIZED, message: SIGN_IN_AGAIN },
    };
  }
  if (person.side !== "owner" || !person.business) {
    return {
      ok: false,
      error: { code: AppErrorCode.FORBIDDEN, message: OWNER_ONLY },
    };
  }
  return { ok: true, businessId: person.business.id };
}

/** El primer problema de Zod como error de la acción, con el campo para marcarlo. */
export function firstIssue(issues: {
  message: string;
  path: PropertyKey[];
}[]): ActionError {
  const issue = issues[0];
  return {
    code: AppErrorCode.VALIDATION_ERROR,
    message: issue.message,
    field: String(issue.path[0] ?? ""),
  };
}
