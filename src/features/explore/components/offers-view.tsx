"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { DEMO_POINT } from "../lib/distance";
import { arrangeOffers, type OfferKind, type OfferSort } from "../lib/offers";
import type { OfferItem } from "../types/explore";
import { OfferCard } from "./offer-card";

export const NO_OFFERS = "No hay ofertas por ahora.";

const SORTS: { value: OfferSort; label: string }[] = [
  { value: "price", label: "Precio" },
  { value: "discount", label: "Descuento" },
  { value: "distance", label: "Cerca" },
];

const KINDS: { value: OfferKind; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "promo", label: "Promo" },
  { value: "combo", label: "Combo" },
];

interface ChoiceRowProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

function ChoiceRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: ChoiceRowProps<T>) {
  const hydrated = useHydrated();
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-14 text-slate">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              disabled={!hydrated}
              onClick={() => onChange(option.value)}
              className={cn(
                "min-h-11 rounded-full px-4 text-14 font-bold transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                selected
                  ? "bg-primary text-surface"
                  : "bg-soft text-slate hover:bg-primary-50",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Ofertas (US-025): ordenar por precio, descuento o cercanía (desde el punto de la demo) y
// filtrar por tipo; las tarjetas en dos columnas en el celular.
export function OffersView({ offers }: { offers: OfferItem[] }) {
  const [sort, setSort] = useState<OfferSort>("price");
  const [kind, setKind] = useState<OfferKind>("all");
  const shown = arrangeOffers(offers, sort, kind, DEMO_POINT);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <ChoiceRow
          label="Ordenar"
          options={SORTS}
          value={sort}
          onChange={setSort}
        />
        <ChoiceRow
          label="Tipo"
          options={KINDS}
          value={kind}
          onChange={setKind}
        />
      </div>
      {shown.length === 0 ? (
        <p role="status" className="py-16 text-center text-16 text-slate">
          {NO_OFFERS}
        </p>
      ) : (
        <ul
          aria-label="Ofertas"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
        >
          {shown.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </ul>
      )}
    </div>
  );
}
