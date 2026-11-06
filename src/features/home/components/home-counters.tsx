import {
  CalendarDays,
  type LucideIcon,
  ReceiptText,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getHomeCounters } from "../services/queries";
import type { HomeCounters as Counters, StaffSide } from "../types/home";
import { CountersError } from "./counters-error";

interface CounterItem {
  key: string;
  icon: LucideIcon;
  iconClassName?: string;
  value: ReactNode;
  label: ReactNode;
  /** El contador que abre su pantalla (Facturas, T-8.2.1; Seguidores, T-14.1.2). */
  href?: string;
}

function formatRating(rating: number | null): string {
  return (rating ?? 0).toLocaleString("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** Del dueño, los cuatro del negocio; del profesional, seguidores, agendamientos y calificación. */
function counterItems(
  side: StaffSide,
  counters: Counters | null,
): CounterItem[] {
  const show = (value: number | string) => (counters ? value : "–");
  const bookings: CounterItem = {
    key: "bookings",
    icon: CalendarDays,
    value: show(counters?.bookings ?? 0),
    label: "Agendamientos",
  };
  const rating: CounterItem = {
    key: "rating",
    icon: Star,
    iconClassName: "fill-warning text-warning",
    value: (
      <>
        <span className="sr-only">Calificación: </span>
        {show(formatRating(counters?.rating ?? null))}
      </>
    ),
    label: (
      <>
        ({show(counters?.reviews ?? 0)})
        <span className="sr-only"> reseñas</span>
      </>
    ),
  };
  // Seguidores abre Estadísticas, del dueño y del profesional (T-14.1.2, captura 142c).
  const followers: CounterItem = {
    key: "followers",
    icon: Users,
    value: show(counters?.followers ?? 0),
    label: "Seguidores del negocio",
    href: "/pro/estadisticas",
  };
  if (side === "staff") return [followers, bookings, rating];
  return [
    followers,
    bookings,
    rating,
    {
      key: "invoices",
      icon: ReceiptText,
      value: show(counters?.invoices ?? 0),
      label: "Facturas",
      href: "/pro/facturas",
    },
  ];
}

function CounterContent({ item }: { item: CounterItem }) {
  return (
    <>
      <item.icon
        className={cn("size-[22px] text-primary", item.iconClassName)}
        strokeWidth={1.8}
      />
      <span className="mt-1 text-18 font-bold text-primary">{item.value}</span>
      <span className="text-12 leading-tight text-slate">{item.label}</span>
    </>
  );
}

function gridClass(side: StaffSide): string {
  return cn(
    "mt-6 grid gap-2",
    side === "owner" ? "grid-cols-4" : "mx-auto max-w-sm grid-cols-3",
  );
}

function CounterGrid({
  side,
  counters,
}: {
  side: StaffSide;
  counters: Counters | null;
}) {
  return (
    <ul className={gridClass(side)}>
      {counterItems(side, counters).map((item) => (
        <li key={item.key} className="flex flex-col items-center text-center">
          {item.href ? (
            <Link
              href={item.href}
              className="flex min-h-11 min-w-11 flex-col items-center rounded-card px-1 transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CounterContent item={item} />
            </Link>
          ) : (
            <CounterContent item={item} />
          )}
        </li>
      ))}
    </ul>
  );
}

// Contadores del encabezado del inicio (UI pantalla 2). Se piden aparte, dentro de un Suspense:
// mientras llegan se ve el esqueleto, nunca ceros.
export async function HomeCounters({
  businessId,
  side,
}: {
  businessId: string;
  side: StaffSide;
}) {
  const counters = await getHomeCounters(businessId);
  return (
    <>
      <CounterGrid side={side} counters={counters} />
      {!counters && <CountersError />}
    </>
  );
}

export function HomeCountersSkeleton({ side }: { side: StaffSide }) {
  return (
    <ul className={gridClass(side)} aria-label="Cargando los contadores">
      {Array.from({ length: side === "owner" ? 4 : 3 }, (_, index) => (
        <li key={index} className="flex flex-col items-center gap-1.5">
          <Skeleton className="size-[22px] rounded-full" />
          <Skeleton className="h-5 w-8" />
          <Skeleton className="h-3 w-16" />
        </li>
      ))}
    </ul>
  );
}
