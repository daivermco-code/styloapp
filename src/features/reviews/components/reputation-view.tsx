import { Frown, type LucideIcon, Meh, Smile } from "lucide-react";
import {
  type ReputationLevel,
  reputationLevel,
} from "@/features/agenda/lib/rules";
import type { MyBooking } from "@/features/booking/types/booking";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/components/empty-state";
import { formatShortDate } from "@/shared/lib/dates";
import { PUNCTUALITY } from "../types/schemas";

export const NO_REPUTATION = "Aún no sabemos cómo es tu reputación.";

interface LevelText {
  title: string;
  advice: string;
  icon: LucideIcon;
  className: string;
}

// Textos propios de cada nivel (US-031); la carita y su color salen del nivel.
const LEVELS: Record<Exclude<ReputationLevel, "unknown">, LevelText> = {
  excellent: {
    title: "Tienes una excelente reputación",
    advice: "Llegas a tiempo a tus citas y los negocios lo notan.",
    icon: Smile,
    className: "text-success",
  },
  regular: {
    title: "Tu reputación es regular",
    advice: "Llegar a tiempo a tus próximas citas la sube.",
    icon: Meh,
    className: "text-warning",
  },
  bad: {
    title: "Tu reputación es mala",
    advice:
      "Faltaste o llegaste tarde a varias citas. Llegar a tiempo la sube.",
    icon: Frown,
    className: "text-danger",
  },
};

const ARRIVAL: Record<
  number,
  { label: string; icon: LucideIcon; className: string }
> = {
  [PUNCTUALITY.onTime]: {
    label: "Llegó a tiempo",
    icon: Smile,
    className: "text-success",
  },
  [PUNCTUALITY.late]: {
    label: "Llegó tarde",
    icon: Meh,
    className: "text-warning",
  },
  [PUNCTUALITY.noShow]: {
    label: "No llegó",
    icon: Frown,
    className: "text-danger",
  },
};

interface ReputationViewProps {
  score: number | null;
  /** Las citas con la llegada marcada, de la más nueva a la más vieja. */
  marked: MyBooking[];
}

// Mi reputación (US-031, capturas 116 y 198): la carita grande del nivel con su consejo y una
// fila por cita marcada. Es la misma en todos los negocios.
export function ReputationView({ score, marked }: ReputationViewProps) {
  const level = reputationLevel(score);
  if (level === "unknown" || marked.length === 0) {
    return (
      <EmptyState
        message={NO_REPUTATION}
        action={
          <p className="text-14 text-slate">
            Se arma cuando el negocio marca si llegaste a tus citas.
          </p>
        }
      />
    );
  }
  const text = LEVELS[level];
  const Icon = text.icon;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Icon className={cn("size-24", text.className)} aria-hidden />
        <h2 className="text-22 font-bold text-primary">{text.title}</h2>
        <p className="max-w-sm text-14 text-slate">{text.advice}</p>
      </div>
      <ul aria-label="Citas marcadas" className="flex flex-col">
        {marked.map((booking) => {
          const arrival = ARRIVAL[booking.punctuality ?? 0];
          if (!arrival) return null;
          const Face = arrival.icon;
          return (
            <li
              key={booking.id}
              className="flex items-center gap-3 border-b border-line py-3"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-16 font-bold text-ink">
                  {booking.staffName}
                </span>
                <span className="text-14 text-ink">{arrival.label}</span>
                <span className="text-12 text-slate">
                  {booking.business.name} · {formatShortDate(booking.startsAt)}
                </span>
              </span>
              <Face
                className={cn("size-6 shrink-0", arrival.className)}
                aria-hidden
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
