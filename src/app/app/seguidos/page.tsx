import type { Metadata } from "next";
import { FollowedList } from "@/features/explore/components/followed-list";
import { listBusinesses } from "@/features/explore/services/queries";
import { ClientTopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Negocios seguidos" };

// Negocios seguidos (US-032, captura 114). Sin sesión, el proxy la reescribe a "Mejora tu
// experiencia".
export default async function FollowedPage() {
  const businesses = await listBusinesses();
  return (
    <>
      <ClientTopBar title="Negocios seguidos" />
      <main className="p-4 md:p-6">
        <FollowedList
          businesses={businesses.filter((business) => business.following)}
        />
      </main>
    </>
  );
}
