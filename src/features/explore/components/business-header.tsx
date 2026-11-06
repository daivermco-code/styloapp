import { MapPin } from "lucide-react";
import Link from "next/link";
import { RatingSummary } from "@/shared/components/stars";
import type { ExploreBusiness } from "../types/explore";
import { BusinessLogo } from "./business-logo";
import { FollowButton } from "./follow-button";

interface BusinessHeaderProps {
  business: ExploreBusiness;
  signedIn: boolean;
}

// Encabezado de la página del negocio (US-026, captura 98): logo, nombre, dirección y barrio;
// debajo, la calificación, Seguir con sus seguidores y los agendamientos. "Ver en el mapa" abre el
// mapa con el negocio elegido (Fase 6).
export function BusinessHeader({ business, signedIn }: BusinessHeaderProps) {
  return (
    <section
      aria-label="El negocio"
      className="flex flex-col gap-4 px-4 pt-5 md:px-6"
    >
      <div className="flex items-center gap-4">
        <BusinessLogo
          name={business.name}
          logoUrl={business.logoUrl}
          size={88}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-25 font-bold leading-tight text-primary">
            {business.name}
          </h2>
          <p className="flex items-start gap-1 text-14 text-slate">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {business.address}
              {business.neighborhood ? ` · ${business.neighborhood}` : ""},{" "}
              {business.city}
            </span>
          </p>
          {business.lat !== null && business.lng !== null && (
            <Link
              href={`/app/mapa?negocio=${business.id}`}
              className="-ml-2 flex min-h-11 items-center self-start rounded-full px-2 text-14 font-bold text-primary hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ver en el mapa
            </Link>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 items-center gap-2 text-center">
        <RatingSummary
          score={business.score}
          reviews={business.reviews}
          className="justify-center"
        />
        <FollowButton
          businessId={business.id}
          following={business.following}
          followers={business.followers}
          signedIn={signedIn}
          next={`/app/negocio/${business.id}`}
        />
        <p className="flex flex-col text-14 text-slate">
          <span className="text-18 font-bold text-ink">
            {business.bookings.toLocaleString("es-CO")}
          </span>
          Agendamientos
        </p>
      </div>
    </section>
  );
}
