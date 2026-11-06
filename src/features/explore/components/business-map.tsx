"use client";

import { MapPin, WifiOff } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { RatingSummary } from "@/shared/components/stars";
import { DEMO_POINT, formatDistance, sortByDistance } from "../lib/distance";
import type { ExploreBusiness } from "../types/explore";
import { BusinessLogo } from "./business-logo";

export const MAP_OFFLINE = "El mapa necesita internet para dibujarse.";

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const MapCanvas = dynamic(() => import("./map-canvas"), {
  ssr: false,
  loading: () => (
    <p
      role="status"
      className="flex size-full items-center justify-center bg-stroke text-14 text-slate"
    >
      Cargando el mapa…
    </p>
  ),
});

// Mapa (US-025): un marcador por negocio y el de "tú" (el punto de la demo); al tocar uno, su
// tarjeta con "Ver negocio". Arranca con el más cercano elegido. Sin internet, el fondo queda
// gris con los marcadores y el aviso.
export function BusinessMap({
  businesses,
  focusId,
}: {
  businesses: ExploreBusiness[];
  /** El negocio que llega elegido (`?negocio=<id>`, desde "Ver en el mapa"). */
  focusId: string | null;
}) {
  const placed = sortByDistance(businesses, DEMO_POINT);
  const [selectedId, setSelectedId] = useState(
    placed.find((business) => business.id === focusId)?.id ??
      placed[0]?.id ??
      null,
  );
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [tilesFailed, setTilesFailed] = useState(false);
  const offline = !online || tilesFailed;
  const selected = placed.find((business) => business.id === selectedId);

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="relative isolate h-[55dvh] overflow-hidden rounded-card shadow-card lg:h-[calc(100dvh-120px)]">
        <MapCanvas
          businesses={placed}
          origin={DEMO_POINT}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onTileError={() => setTilesFailed(true)}
        />
        {offline && (
          <p
            role="status"
            className="absolute inset-x-3 top-3 z-[1000] flex items-center gap-2 rounded-card bg-surface p-3 text-14 text-ink shadow-card"
          >
            <WifiOff className="size-5 shrink-0 text-slate" aria-hidden />
            {MAP_OFFLINE}
          </p>
        )}
      </div>

      {selected && (
        <section
          aria-label="Negocio elegido"
          className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card"
        >
          <div className="flex items-center gap-3">
            <BusinessLogo
              name={selected.name}
              logoUrl={selected.logoUrl}
              size={52}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h2 className="text-18 font-bold text-primary">
                {selected.name}
              </h2>
              <RatingSummary
                score={selected.score}
                reviews={selected.reviews}
              />
              <p className="flex items-center gap-1 text-14 text-slate">
                <MapPin className="size-4 shrink-0" aria-hidden />
                {[
                  selected.neighborhood,
                  selected.distanceKm !== null &&
                    formatDistance(selected.distanceKm),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href={`/app/negocio/${selected.id}`}>Ver negocio</Link>
          </Button>
        </section>
      )}
    </div>
  );
}
