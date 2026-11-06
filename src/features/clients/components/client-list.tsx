import { Lock } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/components/empty-state";
import { formatPhone } from "@/shared/lib/phone";
import {
  type ClientFilter,
  type ClientStat,
  clientsForTab,
  tabDetail,
} from "../lib/tabs";
import { getClientStats } from "../services/queries";

export const NO_CLIENTS_FOUND =
  "No hay clientes que coincidan con la búsqueda.";
export const NO_CLIENTS_IN_TAB = "No hay clientes en esta pestaña.";

/** La inicial del cliente en un círculo de 44 px. */
export function ClientInitial({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-16 font-bold text-primary",
        className,
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** El candado de 16 px junto al nombre de un cliente bloqueado. */
export function BlockedMark() {
  return (
    <>
      <Lock aria-hidden className="size-4 shrink-0 text-slate" />
      <span className="sr-only">(bloqueado)</span>
    </>
  );
}

function ClientRow({
  client,
  detail,
}: {
  client: ClientStat;
  detail: string | null;
}) {
  return (
    <Link
      href={`/pro/clientes/${client.id}`}
      className="flex min-h-16 items-center gap-3 px-5 py-2 transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-6"
    >
      <ClientInitial name={client.fullName} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-16 font-bold text-ink">
            {client.fullName}
          </span>
          {client.isBlocked && <BlockedMark />}
        </span>
        {client.phone && (
          <span className="text-14 text-slate">
            {formatPhone(client.phone)}
          </span>
        )}
      </span>
      {detail && (
        <span className="shrink-0 text-14 font-bold text-primary">
          {detail}
        </span>
      )}
    </Link>
  );
}

// La lista de Clientes (T-10.1.2, US-047, pantalla 14): el servidor filtra y ordena con las reglas
// de la pestaña, y cada fila lleva la inicial, el nombre (con candado si está bloqueado), el
// celular si lo puede ver y su dato. Tocarla abre la ficha.
export async function ClientList({
  businessId,
  filter,
  today,
}: {
  businessId: string;
  filter: ClientFilter;
  today: string;
}) {
  const clients = clientsForTab(
    await getClientStats(businessId),
    filter,
    today,
  );
  if (clients.length === 0)
    return (
      <EmptyState
        message={filter.query ? NO_CLIENTS_FOUND : NO_CLIENTS_IN_TAB}
        className="flex-1"
      />
    );
  return (
    // pb-24: la última fila queda encima del + y del botón de la bandeja.
    <ul
      aria-label="Clientes"
      className="flex-1 divide-y divide-line border-t border-line pb-24"
    >
      {clients.map((client) => (
        <li key={client.id}>
          <ClientRow
            client={client}
            detail={tabDetail(client, filter, today)}
          />
        </li>
      ))}
    </ul>
  );
}

// Mientras llega la lista: 6 filas en esqueleto.
export function ClientListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando los clientes"
      className="flex flex-1 flex-col border-t border-line"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="flex min-h-16 items-center gap-3 border-b border-line px-5 py-2 md:px-6"
        >
          <Skeleton className="size-11 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}
