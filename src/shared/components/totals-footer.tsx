import { cn } from "@/lib/utils";
import { formatCOP } from "@/shared/lib/money";

export interface TotalRow {
  label: string;
  /** Pesos enteros. */
  value: number;
}

interface TotalsFooterProps {
  rows: TotalRow[];
  /** Para lectores de pantalla ("Totales del periodo"). */
  label: string;
  /** Deja sitio al botón + de la esquina (55 px y sus 16 px de borde). */
  besideFab?: boolean;
  /** Sube el botón de la bandeja de la demo para que no tape las etiquetas (no en la columna inerte). */
  liftsInbox?: boolean;
  className?: string;
}

// Pie de totales (T-8.1.2, UI A.1) de Facturas, Gastos y el liquidador: tarjeta pegada abajo,
// esquinas de arriba de 20 px y borde `line`; etiquetas 16 grafito y valores Bold 16 principal.
export function TotalsFooter({
  rows,
  label,
  besideFab = false,
  liftsInbox = true,
  className,
}: TotalsFooterProps) {
  return (
    // data-lifts-inbox: el botón de la bandeja de la demo sube para no tapar las etiquetas.
    <footer
      aria-label={label}
      data-lifts-inbox={liftsInbox ? "" : undefined}
      className={cn(
        "sticky bottom-0 z-20 rounded-t-sheet border border-b-0 border-line bg-surface px-5 py-3 shadow-card",
        besideFab && "pr-[88px]",
        className,
      )}
    >
      <dl className="flex flex-col gap-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-3"
          >
            <dt className="text-16 text-ink">{row.label}</dt>
            <dd className="text-16 font-bold text-primary">
              {formatCOP(row.value)}
            </dd>
          </div>
        ))}
      </dl>
    </footer>
  );
}
