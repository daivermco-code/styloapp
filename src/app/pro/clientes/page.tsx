import { Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOwner } from "@/features/business/services/queries";
import { ClientFilters } from "@/features/clients/components/client-filters";
import {
  ClientList,
  ClientListSkeleton,
} from "@/features/clients/components/client-list";
import {
  type ClientFilter,
  parseClientTab,
  QUERY_MAX,
} from "@/features/clients/lib/tabs";
import { Fab } from "@/shared/components/fab";
import { TopBar } from "@/shared/components/top-bar";
import { todayInBogota } from "@/shared/lib/dates";
import { PendingArea } from "@/shared/components/instant-nav";
import { NAV_GROUP } from "@/shared/lib/instant-nav";

export const metadata: Metadata = { title: "Clientes" };

type ClientSearchParams = {
  pestana?: string | string[];
  cumple?: string | string[];
  q?: string | string[];
};

function parseFilter(params: ClientSearchParams): ClientFilter {
  const tab = parseClientTab(params.pestana);
  return {
    tab,
    query:
      typeof params.q === "string" ? params.q.slice(0, QUERY_MAX).trim() : "",
    birthdays: tab === "todos" && params.cumple === "1",
  };
}

// Clientes del dueño (T-10.1.2, US-047, pantalla 14, capturas 39 y 76 a 79). La pestaña, el
// filtro de cumpleaños y la búsqueda van en la URL (?pestana=, ?cumple=1, ?q=). Al profesional,
// requireOwner lo manda al inicio, y client_stats tampoco le responde.
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<ClientSearchParams>;
}) {
  const owner = await requireOwner("/pro/clientes");
  const filter = parseFilter(await searchParams);

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <TopBar title="Clientes" icon={<Users />} backHref="/pro" />
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col">
        <div className="px-5 pt-3 md:px-6">
          <ClientFilters filter={filter} />
        </div>
        <PendingArea
          groups={[
            NAV_GROUP.clients,
            NAV_GROUP.clientBirthdays,
            NAV_GROUP.clientSearch,
          ]}
          fallback={<ClientListSkeleton />}
        >
          <Suspense
            key={`${filter.tab}-${filter.birthdays}`}
            fallback={<ClientListSkeleton />}
          >
            <ClientList
              businessId={owner.business.id}
              filter={filter}
              today={todayInBogota()}
            />
          </Suspense>
        </PendingArea>
      </main>
      <Fab href="/pro/clientes/nuevo" label="Crear cliente" icon={<Plus />} />
    </div>
  );
}
