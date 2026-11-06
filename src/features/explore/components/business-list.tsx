"use client";

import { LocateFixed, MapPin, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RatingSummary } from "@/shared/components/stars";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import {
  DEMO_POINT,
  formatDistance,
  type GeoPoint,
  sortByDistance,
} from "../lib/distance";
import { plainText } from "../lib/search";
import type { ExploreBusiness } from "../types/explore";
import { BusinessLogo } from "./business-logo";
import { FollowButton } from "./follow-button";

export const NO_RESULTS = "No encontramos negocios con esa búsqueda.";

type Located = ExploreBusiness & { distanceKm: number | null };

function NearbyRow({ business }: { business: Located }) {
  return (
    <li>
      <Link
        href={`/app/negocio/${business.id}`}
        className="flex items-center gap-3 rounded-card bg-surface p-3 shadow-card transition-shadow duration-120 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BusinessLogo
          name={business.name}
          logoUrl={business.logoUrl}
          size={56}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-16 font-bold text-primary">
            {business.name}
          </span>
          <RatingSummary score={business.score} reviews={business.reviews} />
          <span className="truncate text-14 text-slate">
            {[
              business.neighborhood,
              business.distanceKm !== null &&
                formatDistance(business.distanceKm),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      </Link>
    </li>
  );
}

function BusinessCard({
  business,
  signedIn,
}: {
  business: Located;
  signedIn: boolean;
}) {
  const href = `/app/negocio/${business.id}`;
  return (
    <li className="overflow-hidden rounded-card bg-surface shadow-card">
      {business.coverUrl && (
        <Image
          src={business.coverUrl}
          alt=""
          width={800}
          height={400}
          className="aspect-[2/1] w-full object-cover"
        />
      )}
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <BusinessLogo
            name={business.name}
            logoUrl={business.logoUrl}
            size={52}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h3 className="text-18 font-bold text-primary">
              <Link
                href={href}
                className="hover:underline focus-visible:underline"
              >
                {business.name}
              </Link>
            </h3>
            <RatingSummary score={business.score} reviews={business.reviews} />
            <p className="flex items-center gap-1 text-14 text-slate">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {[
                business.neighborhood,
                business.distanceKm !== null &&
                  formatDistance(business.distanceKm),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="text-14 text-ink">{business.address}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <FollowButton
            businessId={business.id}
            following={business.following}
            followers={business.followers}
            signedIn={signedIn}
            next="/app/negocios"
          />
          <p className="flex flex-col items-center text-14 text-slate">
            <span className="text-16 font-bold text-ink">
              {business.bookings.toLocaleString("es-CO")}
            </span>
            agendamientos
          </p>
          <Button asChild>
            <Link href={href}>Agendar</Link>
          </Button>
        </div>
      </div>
    </li>
  );
}

interface BusinessListProps {
  businesses: ExploreBusiness[];
  signedIn: boolean;
  /** "nearby": el Inicio ("Cerca de ti", filas); "cards": Negocios (tarjetas con todo). */
  variant: "nearby" | "cards";
  searchPlaceholder: string;
}

// Buscador y lista de negocios (US-024), ordenados del más cercano al más lejano. La distancia
// sale del punto fijo de la demo en Bogotá, o de la ubicación real si la persona la permite.
export function BusinessList({
  businesses,
  signedIn,
  variant,
  searchPlaceholder,
}: BusinessListProps) {
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [origin, setOrigin] = useState<{ point: GeoPoint; real: boolean }>({
    point: DEMO_POINT,
    real: false,
  });

  const wanted = plainText(deferred);
  const shown = sortByDistance(
    businesses.filter(
      (business) =>
        !wanted ||
        plainText(business.name).includes(wanted) ||
        plainText(business.neighborhood ?? "").includes(wanted),
    ),
    origin.point,
  );

  const locateMe = () => {
    if (!("geolocation" in navigator)) {
      toast(
        "Tu navegador no da la ubicación. Seguimos con el punto de la demo.",
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setOrigin({
          point: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          real: true,
        }),
      () =>
        toast(
          "No pudimos leer tu ubicación. Seguimos con el punto de la demo.",
        ),
      { timeout: 8000 },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="relative block">
        <span className="sr-only">Buscar negocio</span>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          disabled={!hydrated}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          className="rounded-full pl-11"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {variant === "nearby" && (
          <h2 className="text-20 font-bold text-secondary">Cerca de ti</h2>
        )}
        <p className="flex items-center gap-2 text-14 text-slate">
          {origin.real
            ? "Desde tu ubicación"
            : "Desde Chapinero, el punto de la demo"}
          {!origin.real && (
            <button
              type="button"
              onClick={locateMe}
              disabled={!hydrated}
              className="flex min-h-11 items-center gap-1 rounded-full px-2 font-bold text-primary hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LocateFixed className="size-4" aria-hidden />
              Usar mi ubicación
            </button>
          )}
        </p>
      </div>

      {shown.length === 0 ? (
        <p role="status" className="py-10 text-center text-14 text-slate">
          {NO_RESULTS}
        </p>
      ) : (
        <ul
          aria-label="Negocios"
          className={
            variant === "cards"
              ? "grid gap-4 md:grid-cols-2"
              : "flex flex-col gap-3"
          }
        >
          {shown.map((business) =>
            variant === "cards" ? (
              <BusinessCard
                key={business.id}
                business={business}
                signedIn={signedIn}
              />
            ) : (
              <NearbyRow key={business.id} business={business} />
            ),
          )}
        </ul>
      )}
    </div>
  );
}
