import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentPerson } from "@/features/auth/services/queries";
import { StandaloneInbox } from "@/features/demo/components/standalone-inbox";
import { personInboxLabel } from "@/features/demo/services/inbox-label";

export const metadata: Metadata = { title: "Bandeja de la demo" };

// La bandeja a pantalla completa (US-004), con la misma lista de la hoja. Lleva el petróleo
// profundo porque es de la demo, no de la app recreada.
export default async function BandejaPage() {
  const person = await getCurrentPerson();

  return (
    <main className="mx-auto min-h-dvh max-w-[720px] bg-surface">
      <header className="sticky top-0 z-10 flex min-h-14 items-center gap-2 bg-secondary px-3 text-secondary-foreground">
        <Link
          href="/"
          aria-label="Volver al inicio de la demo"
          className="flex size-11 items-center justify-center rounded-full hover:bg-primary-800"
        >
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="text-20 font-bold">Bandeja de la demo</h1>
      </header>
      <StandaloneInbox
        key={person?.phone ?? "sin-sesion"}
        phone={person?.phone ?? null}
        personLabel={person ? personInboxLabel(person) : null}
        side={person?.side ?? null}
      />
    </main>
  );
}
