import type { Metadata } from "next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { getCurrentPerson } from "@/features/auth/services/queries";
import { DetailRows } from "@/shared/components/detail-rows";
import { TopBar } from "@/shared/components/top-bar";
import { formatPhone } from "@/shared/lib/phone";

export const metadata: Metadata = { title: "Perfil" };

// Perfil de la persona en /pro (T-2.1.5, capturas 47 y 150): avatar, nombre, celular, rol y
// negocio, con "Cerrar sesión" arriba a la derecha (criterio de US-003).
export default async function ProProfilePage() {
  const person = await getCurrentPerson();
  if (!person) return null;
  const name = person.fullName ?? "Persona de la demo";

  return (
    <div className="min-h-dvh bg-surface">
      <TopBar
        title="Perfil"
        backHref="/pro"
        actions={
          <SignOutButton
            variant="ghost"
            className="h-auto flex-col gap-0.5 rounded-card px-1 py-1 text-12 font-medium text-slate [&_svg]:size-6"
          />
        }
      />
      <main className="mx-auto flex max-w-[720px] flex-col gap-6 px-5 py-8 md:px-6">
        <section className="flex items-center gap-5">
          <Avatar className="size-[83px] text-30">
            <AvatarFallback>{name.charAt(0)}</AvatarFallback>
          </Avatar>
          <h2 className="min-w-0 text-25 font-medium text-primary">{name}</h2>
        </section>
        <DetailRows
          rows={[
            { label: "Celular", value: formatPhone(person.phone) },
            { label: "Rol", value: person.roleLabel },
            {
              label: "Negocio",
              value: person.business?.name ?? "Sin negocio todavía",
            },
          ]}
        />
      </main>
    </div>
  );
}
