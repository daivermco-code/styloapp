import type { Metadata } from "next";
import { ClientProfileView } from "@/features/booking/components/client-profile";
import { getClientProfile } from "@/features/booking/services/queries";
import { ClientTopBar } from "@/shared/components/top-bar";
import { todayInBogota } from "@/shared/lib/dates";

export const metadata: Metadata = { title: "Perfil" };

// Perfil del cliente (US-032). Sin sesión, el proxy la reescribe a "Mejora tu experiencia".
export default async function ClientProfilePage() {
  const profile = await getClientProfile();
  return (
    <>
      <ClientTopBar title="Perfil" />
      <main className="mx-auto w-full max-w-[720px] p-4 md:p-6">
        {profile && (
          <ClientProfileView profile={profile} today={todayInBogota()} />
        )}
      </main>
    </>
  );
}
