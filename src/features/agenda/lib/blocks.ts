// Modo de bloqueo (US-021): qué cuadritos de 15 minutos quedan elegidos. Puro. Los cuadritos se
// cuentan desde el inicio de la grilla (0 = la primera hora en punto) y el rango elegido va
// seguido y sin citas ni bloqueos.

export interface QuarterRange {
  /** Primer cuadrito elegido. */
  from: number;
  /** Último cuadrito elegido (incluido). */
  to: number;
}

/**
 * La selección después de tocar el cuadrito `quarter`:
 * - sin nada elegido, empieza en él;
 * - fuera del rango, lo alarga hasta él si todo lo de en medio está libre; si no, empieza de nuevo;
 * - en una punta del rango, la quita (si era el único, no queda nada);
 * - en medio del rango, empieza de nuevo en él.
 * Un cuadrito ocupado no cambia nada.
 */
export function toggleQuarter(
  selection: QuarterRange | null,
  quarter: number,
  isFree: (quarter: number) => boolean,
): QuarterRange | null {
  if (!isFree(quarter)) return selection;
  if (!selection) return { from: quarter, to: quarter };
  const { from, to } = selection;
  if (quarter === from && quarter === to) return null;
  if (quarter === from) return { from: from + 1, to };
  if (quarter === to) return { from, to: to - 1 };
  if (quarter > from && quarter < to) return { from: quarter, to: quarter };

  const low = Math.min(quarter, from);
  const high = Math.max(quarter, to);
  for (let item = low; item <= high; item++) {
    if (!isFree(item)) return { from: quarter, to: quarter };
  }
  return { from: low, to: high };
}

/** Minutos que cierra la selección. */
export function selectionMinutes(selection: QuarterRange): number {
  return (selection.to - selection.from + 1) * 15;
}
