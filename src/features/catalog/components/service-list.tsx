import { ChevronDown, Pencil } from "lucide-react";
import Link from "next/link";
import { formatMinutes } from "@/shared/lib/duration";
import { formatServicePrice } from "../lib/price";
import {
  AUDIENCE_LABELS,
  type CatalogCategory,
  type Service,
} from "../types/catalog";
import { ServiceStateButton } from "./service-state-button";

function ServiceCard({ service }: { service: Service }) {
  return (
    <li className="flex items-end justify-between gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="text-16 font-bold text-primary">{service.name}</h3>
        <p className="text-16 text-ink">{formatServicePrice(service)}</p>
        <p className="text-14 text-slate">
          Duración: {formatMinutes(service.durationMinutes)}
          {service.audience !== "unisex" &&
            ` · ${AUDIENCE_LABELS[service.audience]}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href={`/pro/servicios/${service.id}`}
          aria-label={`Editar ${service.name}`}
          className="flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 rounded-card px-2 py-1 text-14 text-primary transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Pencil className="size-5" />
          Editar
        </Link>
        <ServiceStateButton
          id={service.id}
          name={service.name}
          active={service.isActive}
        />
      </div>
    </li>
  );
}

// Servicios por categoría plegable (T-2.3.1, captura 30). Solo salen las categorías con servicios
// en la pestaña elegida.
export function ServiceList({
  categories,
  active,
}: {
  categories: CatalogCategory[];
  active: boolean;
}) {
  const groups = categories
    .map((category) => ({
      ...category,
      services: category.services.filter(
        (service) => service.isActive === active,
      ),
    }))
    .filter((category) => category.services.length > 0);

  return (
    <div className="flex flex-col gap-2">
      {groups.map((category) => (
        <details key={category.id} open className="group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 border-b border-stroke py-2 text-primary [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-5 shrink-0 transition-transform duration-180 group-open:rotate-180" />
            <h2 className="text-18 font-bold">{category.name}</h2>
            <span className="text-14 text-slate">
              ({category.services.length})
            </span>
          </summary>
          <ul className="flex flex-col gap-3 py-4">
            {category.services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
