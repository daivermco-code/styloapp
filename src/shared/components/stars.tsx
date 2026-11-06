import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Una calificación como se lee: 4.4 → "4,4". */
export function formatScore(score: number): string {
  return score.toLocaleString("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

interface StarsProps {
  /** De 0 a 5; se redondea a la estrella entera más cercana. */
  value: number;
  size?: "sm" | "md";
  className?: string;
}

// Cinco estrellas de solo lectura (ámbar estrella, DESIGN.md §2): llenas hasta el valor.
export function Stars({ value, size = "sm", className }: StarsProps) {
  const filled = Math.round(value);
  return (
    <span
      role="img"
      aria-label={`${value} de 5 estrellas`}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          aria-hidden
          className={cn(
            size === "sm" ? "size-3.5" : "size-5",
            "text-warning",
            index < filled && "fill-warning",
          )}
        />
      ))}
    </span>
  );
}

interface RatingSummaryProps {
  score: number | null;
  reviews: number;
  className?: string;
}

// "★ 4,4 (57)", o "Sin reseñas todavía." (US-026).
export function RatingSummary({
  score,
  reviews,
  className,
}: RatingSummaryProps) {
  if (score === null || reviews === 0) {
    return (
      <span className={cn("text-14 text-slate", className)}>
        Sin reseñas todavía.
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-14", className)}>
      <Star aria-hidden className="size-4 fill-warning text-warning" />
      <span className="font-bold text-ink">
        <span className="sr-only">Calificación: </span>
        {formatScore(score)}
      </span>
      <span className="text-slate">
        ({reviews}
        <span className="sr-only"> reseñas</span>)
      </span>
    </span>
  );
}
