import { redirect } from "next/navigation";
import { getCurrentPerson } from "@/features/auth/services/queries";
import { SideMenu } from "@/features/home/components/side-menu";
import { BrandLogo } from "@/shared/components/brand-logo";

// App del negocio y del equipo. En el celular cada página trae su barra superior; desde 1024 px
// hay menú lateral de 260 px con los módulos y el contenido al centro. El menú se queda quieto y
// solo la lista de módulos se desplaza; el pie no se mueve y deja 80 px para el botón de la
// bandeja, que va fijo en esa esquina y así nunca tapa un módulo.
export default async function ProLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // El proxy ya protege /pro (invariante 1); esto evita pintar la zona sin persona.
  const person = await getCurrentPerson();
  if (!person) redirect("/entrar?siguiente=/pro");

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:p-5 lg:pb-20">
        <BrandLogo size={34} />
        <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2 py-1">
          {person.business && (
            <SideMenu side={person.side === "owner" ? "owner" : "staff"} />
          )}
        </div>
        <p className="text-12 text-slate">
          {person.fullName}
          <br />
          {person.roleLabel}
          {person.business ? ` · ${person.business.name}` : ""}
        </p>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
