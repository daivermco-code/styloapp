import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { CurrentPerson } from "../services/queries";

// Saludo con avatar de la inicial, "Hola," en gris, el nombre y "rol · negocio" (UI pantalla 2).
export function PersonGreeting({ person }: { person: CurrentPerson }) {
  const name = person.fullName ?? "Persona de la demo";
  return (
    <section className="flex items-center gap-4 rounded-card bg-surface p-4 shadow-card">
      <Avatar className="h-[55px] w-[55px] text-22">
        <AvatarFallback>{name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-14 text-slate">Hola,</p>
        <p className="truncate text-25 font-medium text-primary">{name}</p>
        <p className="text-12 text-slate">
          {person.roleLabel}
          {person.business ? ` · ${person.business.name}` : ""}
        </p>
      </div>
    </section>
  );
}
