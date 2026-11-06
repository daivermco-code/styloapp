import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/shared/lib/money";

interface IndicatorCardProps {
  title: string;
  /** Pesos enteros; Utilidades puede ser negativa. */
  value: number;
  /** La variación, o la línea que va en su lugar ("Llegan después"). */
  footer: ReactNode;
  /** Ventas generales y Utilidades: borde de 2 px principal y todo el ancho. */
  featured?: boolean;
}

/** "−$ 80.000": el negativo con el signo menos tipográfico. */
export function formatSignedCOP(value: number): string {
  return value < 0 ? `−${formatCOP(-value)}` : formatCOP(value);
}

// Tarjeta de indicador (T-13.1.1, UI B.1, captura 32): título Bold 16 petróleo profundo, el valor
// Bold 22 principal y la variación debajo, todo centrado. La destacada va con borde y a todo el
// ancho; las demás, de dos en dos sobre el fondo gris.
export function IndicatorCard({
  title,
  value,
  footer,
  featured = false,
}: IndicatorCardProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-h-[148px] flex-col items-center justify-center gap-2 rounded-sheet bg-surface px-3 py-5 text-center",
        featured
          ? "col-span-2 border-2 border-primary md:col-span-3"
          : "shadow-card",
      )}
    >
      <h2 className="text-16 font-bold text-secondary">{title}</h2>
      <p
        className={cn(
          "text-22 font-bold",
          value < 0 ? "text-danger" : "text-primary",
        )}
      >
        {formatSignedCOP(value)}
      </p>
      {footer}
    </section>
  );
}
