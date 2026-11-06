import Link from "next/link";
import { BlockClientButton } from "@/features/agenda/components/block-client-button";
import { EmptyState } from "@/shared/components/empty-state";
import { formatPhone } from "@/shared/lib/phone";
import { getClientStats } from "../services/queries";
import { ClientInitial } from "./client-list";

export const NO_BLOCKED = "No has bloqueado a ningún cliente.";

// Usuarios bloqueados (T-10.2.1, US-049, pantalla 17, captura 71): los clientes que no pueden
// reservar en línea, con su inicial, su nombre (abre la ficha) y "Desbloquear", que pide
// confirmar como en la cita (US-020).
export async function BlockedList({ businessId }: { businessId: string }) {
  const blocked = (await getClientStats(businessId)).filter(
    (client) => client.isBlocked,
  );
  if (blocked.length === 0) return <EmptyState message={NO_BLOCKED} />;
  return (
    <ul
      aria-label="Clientes bloqueados"
      className="divide-y divide-line border-y border-line"
    >
      {blocked.map((client) => (
        <li
          key={client.id}
          className="flex min-h-16 items-center gap-3 px-5 py-2 md:px-6"
        >
          <ClientInitial name={client.fullName} />
          <Link
            href={`/pro/clientes/${client.id}`}
            className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="truncate text-16 font-bold text-ink">
              {client.fullName}
            </span>
            {client.phone && (
              <span className="text-14 text-slate">
                {formatPhone(client.phone)}
              </span>
            )}
          </Link>
          <BlockClientButton
            clientId={client.id}
            name={client.fullName}
            blocked
            look="compact"
          />
        </li>
      ))}
    </ul>
  );
}
