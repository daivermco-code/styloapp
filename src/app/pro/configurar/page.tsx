import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SettingsMenu } from "@/features/business/components/settings-menu";
import { pickFunctions } from "@/features/business/lib/functions";
import {
  getBusinessSettings,
  requireOwner,
} from "@/features/business/services/queries";
import { TopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Configurar negocio" };

export default async function BusinessSettingsPage() {
  const owner = await requireOwner("/pro/configurar");
  const settings = await getBusinessSettings(owner.business.id);
  if (!settings) notFound();

  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title="Configurar negocio" backHref="/pro" />
      <main className="mx-auto max-w-[720px] px-5 pb-24 pt-4 md:px-6">
        <SettingsMenu functions={pickFunctions(settings)} />
      </main>
    </div>
  );
}
