import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BusinessLinkCard } from "@/features/business/components/business-link-card";
import { BusinessProfileForm } from "@/features/business/components/business-profile-form";
import {
  getBusinessSettings,
  requireOwner,
} from "@/features/business/services/queries";
import { TopBar } from "@/shared/components/top-bar";
import { localDigits } from "@/shared/lib/phone";

export const metadata: Metadata = { title: "Perfil del negocio" };

// Perfil del negocio (T-2.2.2, US-008, captura 66). El logo y la portada son fijos en la demo.
export default async function BusinessProfilePage() {
  const owner = await requireOwner("/pro/configurar/negocio");
  const business = await getBusinessSettings(owner.business.id);
  if (!business) notFound();
  const initial = {
    name: business.name,
    address: business.address,
    neighborhood: business.neighborhood ?? "",
    city: business.city,
    whatsapp: business.whatsapp ? (localDigits(business.whatsapp) ?? "") : "",
  };

  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title="Perfil del negocio" backHref="/pro/configurar" />
      <main className="mx-auto flex max-w-[720px] flex-col gap-6 px-5 pb-24 pt-6 md:px-6">
        <BusinessLinkCard slug={business.slug} />
        <div className="flex items-center gap-4">
          <Avatar className="size-[55px] shrink-0 text-25">
            <AvatarFallback>{business.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <p className="text-14 text-slate">
            El logo y la portada son fijos en la demo: no se suben fotos.
          </p>
        </div>
        {/* key: después de guardar, el formulario arranca de lo guardado. */}
        <BusinessProfileForm key={JSON.stringify(initial)} initial={initial} />
      </main>
    </div>
  );
}
