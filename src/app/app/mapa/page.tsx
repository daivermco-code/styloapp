import type { Metadata } from "next";
import { BusinessMap } from "@/features/explore/components/business-map";
import { listBusinesses } from "@/features/explore/services/queries";
import { ClientTopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Mapa" };

interface MapPageProps {
  searchParams: Promise<{ negocio?: string | string[] }>;
}

// Mapa (US-025): los negocios en OpenStreetMap. No pide sesión. Con `?negocio=<id>` ("Ver en el
// mapa" de la página del negocio) arranca con ese elegido.
export default async function MapaPage({ searchParams }: MapPageProps) {
  const [{ negocio }, businesses] = await Promise.all([
    searchParams,
    listBusinesses(),
  ]);
  return (
    <>
      <ClientTopBar title="Mapa" />
      <main className="p-4 md:p-6">
        <BusinessMap
          businesses={businesses}
          focusId={typeof negocio === "string" ? negocio : null}
        />
      </main>
    </>
  );
}
