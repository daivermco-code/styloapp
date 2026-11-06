import Image from "next/image";
import Link from "next/link";
import { RatingSummary } from "@/shared/components/stars";
import { formatCOP } from "@/shared/lib/money";
import { formatDistance } from "../lib/distance";
import type { PlacedOffer } from "../lib/offers";

// Tarjeta de Ofertas (US-025): foto, etiqueta (Promo o Combo) con el descuento, calificación del
// negocio, nombre, negocio, precio y distancia. Tocarla abre el negocio.
export function OfferCard({ offer }: { offer: PlacedOffer }) {
  return (
    <li>
      <Link
        href={`/app/negocio/${offer.business.id}`}
        className="flex h-full flex-col overflow-hidden rounded-card bg-surface shadow-card transition-shadow duration-120 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="relative block">
          {offer.imageUrl ? (
            <Image
              src={offer.imageUrl}
              alt=""
              width={320}
              height={240}
              className="aspect-[4/3] w-full bg-soft object-cover"
            />
          ) : (
            <span aria-hidden className="block aspect-[4/3] w-full bg-soft" />
          )}
          <span className="absolute left-2 top-2 rounded-full bg-secondary px-2 text-12 font-bold text-secondary-foreground">
            {offer.kind === "combo" ? "Combo" : "Promo"}
          </span>
          {offer.discountPct !== null && (
            <span className="absolute right-2 top-2 rounded-full bg-danger px-2 text-12 font-bold text-secondary-foreground">
              −{offer.discountPct} %
            </span>
          )}
        </span>
        <span className="flex flex-1 flex-col gap-1 p-3">
          <RatingSummary
            score={offer.business.score}
            reviews={offer.business.reviews}
            className="text-12"
          />
          <span className="text-16 font-bold leading-tight text-ink">
            {offer.name}
          </span>
          <span className="truncate text-14 text-slate">
            {offer.business.name}
          </span>
          <span className="mt-auto flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="text-16 font-bold text-primary">
              {formatCOP(offer.price)}
            </span>
            {offer.distanceKm !== null && (
              <span className="text-12 text-slate">
                {formatDistance(offer.distanceKm)}
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
