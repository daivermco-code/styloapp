import { Skeleton } from "@/components/ui/skeleton";
import type { BusinessInsights } from "../types/report";

const CARD =
  "flex min-h-[148px] flex-col items-center justify-center gap-2 rounded-sheet border-2 border-primary bg-surface px-2 py-5 text-center";

// Las tres tarjetas de Estadísticas (T-14.1.2, US-058, captura 40): Seguidores, Reservas de
// usuarios y Visitas al perfil, con borde de 2 px principal, el nombre en 16 petróleo profundo y
// el número en Bold 22 principal.
export function StatsCards({ insights }: { insights: BusinessInsights }) {
  const cards = [
    { label: "Seguidores", value: insights.followers },
    { label: "Reservas de usuarios", value: insights.clientBookings },
    { label: "Visitas al perfil", value: insights.visits },
  ];
  return (
    <ul className="grid grid-cols-3 gap-2 md:gap-4">
      {cards.map((card) => (
        <li key={card.label}>
          <section aria-label={card.label} className={CARD}>
            <h2 className="text-16 text-secondary">{card.label}</h2>
            <p className="text-22 font-bold text-primary">
              {card.value.toLocaleString("es-CO")}
            </p>
          </section>
        </li>
      ))}
    </ul>
  );
}

export function StatsCardsSkeleton() {
  return (
    <ul
      className="grid grid-cols-3 gap-2 md:gap-4"
      aria-label="Cargando las estadísticas"
    >
      {[0, 1, 2].map((index) => (
        <li key={index} className={CARD}>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-10" />
        </li>
      ))}
    </ul>
  );
}
