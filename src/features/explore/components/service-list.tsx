"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BookingCategoryOption } from "@/features/agenda/types/agenda";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { formatShortDate } from "@/shared/lib/dates";
import { formatMinutes } from "@/shared/lib/duration";
import { formatCOP } from "@/shared/lib/money";
import type { ExplorePromotion } from "../types/explore";

interface ServiceListProps {
  categories: BookingCategoryOption[];
  /** Con búsqueda, todas las categorías con resultados van abiertas. */
  searching: boolean;
  onBook: (serviceId: string) => void;
}

// Lista de servicios por categoría plegable (US-026, capturas 98 y 99): nombre, precio, duración
// y Agendar. La primera categoría abre desplegada.
export function ServiceList({
  categories,
  searching,
  onBook,
}: ServiceListProps) {
  const hydrated = useHydrated();
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(categories.slice(0, 1).map((category) => category.id)),
  );
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ul className="flex flex-col">
      {categories.map((category) => {
        const expanded = searching || open.has(category.id);
        return (
          <li key={category.id} className="border-b border-line">
            <button
              type="button"
              aria-expanded={expanded}
              disabled={!hydrated}
              onClick={() => toggle(category.id)}
              className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-18 font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default"
            >
              <ChevronDown
                aria-hidden
                className={cn(
                  "size-5 transition-transform duration-120",
                  expanded && "rotate-180",
                )}
              />
              {category.name}
            </button>
            {expanded && (
              <ul aria-label={`Servicios de ${category.name}`} className="pb-2">
                {category.services.map((service) => (
                  <li
                    key={service.id}
                    className="mx-4 flex items-center gap-3 border-t border-line py-3"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-16 font-bold text-ink">
                        {service.name}
                      </span>
                      <span className="text-16 text-ink">
                        {service.priceLabel}
                      </span>
                      <span className="text-14 text-slate">
                        {formatMinutes(service.durationMinutes)} aprox.
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!hydrated}
                      aria-label={`Agendar ${service.name}`}
                      onClick={() => onBook(service.id)}
                    >
                      Agendar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// Promociones y combos vigentes (interruptor de la página del negocio). En el MVP no se reservan
// desde aquí: se gestionan y se enlazan a servicios en la oleada 6.
export function PromotionList({
  promotions,
}: {
  promotions: ExplorePromotion[];
}) {
  if (promotions.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-14 text-slate">
        Este negocio no tiene promociones por ahora.
      </p>
    );
  }
  return (
    <ul aria-label="Promociones" className="grid gap-3 px-4 md:grid-cols-2">
      {promotions.map((promotion) => (
        <li
          key={promotion.id}
          className="flex gap-3 overflow-hidden rounded-card bg-surface shadow-card"
        >
          {promotion.imageUrl && (
            <Image
              src={promotion.imageUrl}
              alt=""
              width={112}
              height={112}
              className="size-28 shrink-0 object-cover"
            />
          )}
          <div className="flex min-w-0 flex-col gap-1 py-3 pr-3">
            <span className="self-start rounded-full bg-tertiary px-2 text-12 font-bold text-secondary">
              {promotion.kind === "combo"
                ? "Combo"
                : `Promo${promotion.discountPct ? ` −${promotion.discountPct} %` : ""}`}
            </span>
            <span className="text-16 font-bold text-ink">{promotion.name}</span>
            {promotion.description && (
              <span className="text-14 text-slate">
                {promotion.description}
              </span>
            )}
            <span className="text-16 font-bold text-primary">
              {formatCOP(promotion.price)}
            </span>
            {promotion.endsOn && (
              <span className="text-12 text-slate">
                Hasta el {formatShortDate(`${promotion.endsOn}T12:00:00-05:00`)}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
