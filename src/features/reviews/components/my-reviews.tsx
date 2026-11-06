import { EmptyState } from "@/shared/components/empty-state";
import { formatScore, Stars } from "@/shared/components/stars";
import { formatShortDate } from "@/shared/lib/dates";
import type { MyReview } from "../types/review";
import { ATTENTION_LABEL, QUALITY_LABEL } from "../types/schemas";

export const NO_REVIEWS = "Todavía no has dejado reseñas.";

function StarLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-14 text-ink">{label}</span>
      <Stars value={value} size="md" />
    </div>
  );
}

// Mis reseñas (US-031, capturas 115 y 204): una tarjeta por reseña con el negocio, la fecha, el
// promedio, las dos calificaciones con estrellas y el servicio.
export function MyReviews({ reviews }: { reviews: MyReview[] }) {
  if (reviews.length === 0) return <EmptyState message={NO_REVIEWS} />;
  return (
    <ul aria-label="Mis reseñas" className="grid gap-4 md:grid-cols-2">
      {reviews.map((review) => (
        <li
          key={review.id}
          className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-16 font-bold text-ink">
                {review.businessName}
              </span>
              <span className="text-12 text-slate">
                {formatShortDate(review.createdAt)}
              </span>
            </div>
            <span className="text-30 font-bold text-primary">
              <span className="sr-only">Promedio: </span>
              {formatScore((review.attention + review.quality) / 2)}
            </span>
          </div>
          <StarLine label={ATTENTION_LABEL} value={review.attention} />
          <StarLine label={QUALITY_LABEL} value={review.quality} />
          <p className="text-14 text-slate">
            Servicio: {review.serviceName} con {review.staffName}
          </p>
          {review.comment && (
            <p className="text-14 text-ink">“{review.comment}”</p>
          )}
        </li>
      ))}
    </ul>
  );
}
