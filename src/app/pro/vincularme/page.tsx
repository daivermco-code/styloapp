import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { getCurrentPerson } from "@/features/auth/services/queries";
import { LinkForm } from "@/features/team/components/link-form";
import { TopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Vincularme a un negocio" };

// El profesional sin negocio llega aquí (proxy) y entra al equipo con el código del dueño
// (T-2.4.1, US-012). El QR de Equipo trae el código en ?codigo=.
export default async function LinkToBusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const person = await getCurrentPerson();
  if (!person) redirect("/entrar?siguiente=/pro/vincularme");
  if (person.business) redirect("/pro");
  const { codigo } = await searchParams;
  const firstName = person.fullName?.split(" ")[0] ?? "";

  return (
    <div className="min-h-dvh bg-surface">
      {/* Atrás, al inicio de la demo (ASCII del Blueprint): ahí se cambia de persona. */}
      <TopBar title="Vincularme a un negocio" backHref="/" />
      <main className="mx-auto flex max-w-[480px] flex-col gap-6 px-5 pb-24 pt-6 md:px-6">
        <p className="text-16 text-ink">
          Pídele al dueño el código de su negocio. Lo ve en Equipo.
        </p>
        <LinkForm initialCode={codigo ?? ""} initialName={firstName} />
        <div className="flex flex-col items-center gap-2 border-t border-line pt-6 text-center">
          <p className="text-14 text-slate">¿Entraste con otro celular?</p>
          <SignOutButton />
        </div>
      </main>
    </div>
  );
}
