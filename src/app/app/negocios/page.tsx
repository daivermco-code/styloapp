import type { Metadata } from "next";
import { getCurrentPerson } from "@/features/auth/services/queries";
import { BusinessList } from "@/features/explore/components/business-list";
import { listBusinesses } from "@/features/explore/services/queries";
import { ClientTopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Negocios" };

// Negocios (US-024, captura 91): buscador por barrio o nombre y una tarjeta por negocio, del más
// cercano al más lejano. No pide sesión.
export default async function BusinessesPage() {
  const [person, businesses] = await Promise.all([
    getCurrentPerson(),
    listBusinesses(),
  ]);
  return (
    <>
      <ClientTopBar title="Negocios" />
      <main className="p-4 md:p-6">
        <BusinessList
          businesses={businesses}
          signedIn={person !== null}
          variant="cards"
          searchPlaceholder="Busca por barrio o nombre"
        />
      </main>
    </>
  );
}
