import type { Metadata } from "next";
import { OffersView } from "@/features/explore/components/offers-view";
import { listOffers } from "@/features/explore/services/queries";
import { ClientTopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Ofertas" };

// Ofertas (US-025): las promociones y combos vigentes de los negocios. No pide sesión.
export default async function OfertasPage() {
  const offers = await listOffers();
  return (
    <>
      <ClientTopBar title="Ofertas" />
      <main className="p-4 md:p-6">
        <OffersView offers={offers} />
      </main>
    </>
  );
}
