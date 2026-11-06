import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import {
  type CurrentPerson,
  getCurrentPerson,
} from "@/features/auth/services/queries";
import { PersonaPicker } from "@/features/demo/components/persona-picker";
import { ResetDemoButton } from "@/features/demo/components/reset-demo-button";
import { listDemoPersonas } from "@/features/demo/services/queries";
import { BrandLogo } from "@/shared/components/brand-logo";
import { EmptyState } from "@/shared/components/empty-state";

function homeOf(person: CurrentPerson): string {
  return person.side === "client" ? "/app" : "/pro";
}

// Inicio de la demo (US-002, UI pantalla 1): con quién entrar, la sesión abierta y el reinicio.
export default async function DemoHomePage() {
  const [person, personas] = await Promise.all([
    getCurrentPerson(),
    listDemoPersonas(),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-4 py-6">
      {person && (
        <section className="flex flex-col gap-3 rounded-card bg-secondary p-4 text-secondary-foreground">
          <p className="text-14">
            Estás como{" "}
            <strong>{person.fullName ?? "persona sin nombre"}</strong>,{" "}
            {person.roleLabel.toLowerCase()}
            {person.business ? ` en ${person.business.name}` : ""}.
          </p>
          <div className="flex gap-2">
            <Button
              asChild
              size="sm"
              className="bg-surface text-secondary hover:bg-primary-50"
            >
              <Link href={homeOf(person)}>Seguir</Link>
            </Button>
            <SignOutButton
              label="Cambiar"
              variant="ghost"
              className="h-10 px-4 text-14 text-secondary-foreground hover:bg-primary-800"
            />
          </div>
        </section>
      )}

      <header className="flex flex-col items-center gap-3">
        <BrandLogo size={55} />
        <h1 className="text-22 font-bold text-primary">¿Con quién entras?</h1>
      </header>

      {personas.length > 0 ? (
        <PersonaPicker personas={personas} />
      ) : (
        <EmptyState
          message="La demo está vacía. Reiníciala para crear los datos."
          action={<ResetDemoButton variant="default" />}
        />
      )}

      <footer className="mt-auto flex flex-col items-center gap-3 pt-2">
        {personas.length > 0 && <ResetDemoButton />}
        <p className="text-12 text-slate">
          Demo local: nada se envía de verdad.
        </p>
      </footer>
    </main>
  );
}
