// Reglas puras de las citas (Tech Spec §5.2): cruces, hasta cuándo cancela el cliente y el nivel
// de reputación. Reciben la hora actual como parámetro.
import { minutesBetween } from "@/shared/lib/dates";

/** Un rango de tiempo [inicio, fin), en ISO. */
export interface Interval {
  startsAt: string;
  endsAt: string;
}

/** Dos rangos se cruzan si se pisan; pegados (uno termina cuando empieza el otro) no. */
export function overlaps(a: Interval, b: Interval): boolean {
  return (
    Date.parse(a.startsAt) < Date.parse(b.endsAt) &&
    Date.parse(b.startsAt) < Date.parse(a.endsAt)
  );
}

/** El cliente cancela solo si falta más que el límite del negocio para la cita. */
export function canClientCancel(
  startsAt: string,
  limitMinutes: number,
  now: string,
): boolean {
  return minutesBetween(now, startsAt) > limitMinutes;
}

export type ReputationLevel = "unknown" | "excellent" | "regular" | "bad";

/**
 * Nivel de la reputación del cliente a partir del promedio de sus llegadas (5 a tiempo, 3 tarde,
 * 1 no llegó). Criterio propio: sin calificaciones, sin datos; 4 o más, excelente; de 2,5 a
 * 3,99, regular; menos de 2,5, mala.
 */
export function reputationLevel(score: number | null): ReputationLevel {
  if (score === null) return "unknown";
  if (score >= 4) return "excellent";
  if (score >= 2.5) return "regular";
  return "bad";
}

const REPUTATION: Record<ReputationLevel, string> = {
  excellent: "Excelente",
  regular: "Regular",
  bad: "Mala",
  unknown: "Sin calificaciones todavía",
};

/** "Excelente (4,5 de 5)", o "Sin calificaciones todavía". En la cita y en la ficha del cliente. */
export function reputationText(reputation: { score: number } | null): string {
  if (!reputation) return REPUTATION.unknown;
  const score = reputation.score.toLocaleString("es-CO", {
    maximumFractionDigits: 1,
  });
  return `${REPUTATION[reputationLevel(reputation.score)]} (${score} de 5)`;
}
