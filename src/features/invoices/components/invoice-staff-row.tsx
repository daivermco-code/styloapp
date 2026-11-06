import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { InstantLink } from "@/shared/components/instant-nav";
import { NAV_GROUP } from "@/shared/lib/instant-nav";
import type { InvoiceStaffOption } from "../types/invoice";

interface InvoiceStaffRowProps {
  options: InvoiceStaffOption[];
  /** El elegido; null es "Todos". */
  selectedId: string | null;
  /** La dirección de Facturas con otro profesional, sin perder el periodo ni el filtro. */
  hrefFor: (staffId: string | null) => string;
}

const ALL: InvoiceStaffOption = { id: "", name: "Todos" };

// Fila de profesionales de Facturas (T-8.2.1, US-042, UI A.1): solo la ve el dueño. Primero
// "Todos" (inicial T) y luego el equipo activo; el elegido lleva el aro petróleo profundo, como el
// selector de profesional de la ficha. Responde al tocarlo (Fase 17): el aro pasa de una, por
// `aria-current`, y la página tapa su lista con PendingArea del grupo `staff`.
export function InvoiceStaffRow({
  options,
  selectedId,
  hrefFor,
}: InvoiceStaffRowProps) {
  return (
    <nav aria-label="Profesional" className="-mx-5 md:-mx-6">
      <ul className="flex gap-3 overflow-x-auto px-5 py-1 [scrollbar-width:none] md:px-6 [&::-webkit-scrollbar]:hidden">
        {[ALL, ...options].map((option) => {
          const selected = (option.id || null) === selectedId;
          return (
            <li key={option.id || "todos"} className="shrink-0">
              <InstantLink
                href={hrefFor(option.id || null)}
                group={NAV_GROUP.staff}
                selected={selected}
                className="group flex w-[72px] flex-col items-center gap-1 rounded-card py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="size-14 text-22 group-aria-[current=page]:ring-[3px] group-aria-[current=page]:ring-secondary group-aria-[current=page]:ring-offset-2">
                  <AvatarFallback>{option.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="w-full truncate text-center text-14 text-ink group-aria-[current=page]:font-bold group-aria-[current=page]:text-primary">
                  {option.name}
                </span>
              </InstantLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
