import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/shared/lib/money";

interface MoneyRowProps {
  title: string;
  /** La línea de apoyo en 12 gris (cliente y servicios, categoría, fecha). */
  detail?: string;
  /** Pesos enteros. */
  value: number;
  /** Anulada: el valor tachado y la etiqueta "Anulada" en rojo. */
  voided?: boolean;
  /** Abre el detalle; sin él, la fila solo se lee. */
  href?: string;
}

const ROW =
  "flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left md:px-6";

// Fila de dinero (T-8.1.2, UI A.1) de Facturas, Gastos y el historial de pagos: título 16, apoyo
// 12 gris y el valor Bold 16 a la derecha.
export function MoneyRow({
  title,
  detail,
  value,
  voided = false,
  href,
}: MoneyRowProps) {
  const content = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-16 text-ink">{title}</span>
        {detail && (
          <span className="line-clamp-2 text-12 text-slate">{detail}</span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span
          className={cn(
            "text-16 font-bold",
            voided ? "text-slate line-through" : "text-primary",
          )}
        >
          {voided && <span className="sr-only">Valor anulado: </span>}
          {formatCOP(value)}
        </span>
        {voided && (
          <span className="text-12 font-bold text-danger">Anulada</span>
        )}
      </span>
      {href && (
        <ChevronRight className="size-5 shrink-0 text-slate" aria-hidden />
      )}
    </>
  );
  if (!href) return <div className={ROW}>{content}</div>;
  return (
    <Link
      href={href}
      className={cn(
        ROW,
        "transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      )}
    >
      {content}
    </Link>
  );
}
