import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BusinessFunctionsForm } from "@/features/business/components/business-functions-form";
import { pickFunctions } from "@/features/business/lib/functions";
import {
  getBusinessSettings,
  requireOwner,
} from "@/features/business/services/queries";
import { TopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Funciones adicionales" };

export default async function BusinessFunctionsPage() {
  const owner = await requireOwner("/pro/configurar/funciones");
  const settings = await getBusinessSettings(owner.business.id);
  if (!settings) notFound();
  const functions = pickFunctions(settings);

  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title="Funciones adicionales" backHref="/pro/configurar" />
      <main className="mx-auto max-w-[720px] px-5 pb-24 pt-2 md:px-6">
        {/* key: después de guardar, el formulario arranca de lo guardado. */}
        <BusinessFunctionsForm
          key={JSON.stringify(functions)}
          initial={functions}
        />
      </main>
    </div>
  );
}
