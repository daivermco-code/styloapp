import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { CurrentPerson } from "@/features/auth/services/queries";
import type { HomeBusiness, StaffSide } from "../types/home";
import { HomeActions } from "./home-actions";

interface HomeHeaderProps {
  person: CurrentPerson;
  business: HomeBusiness;
  side: StaffSide;
  /** Los contadores, que llegan aparte. */
  children: ReactNode;
}

// Encabezado del inicio (UI pantalla 2, captura 21): blanco hueso con las esquinas de abajo de
// 25 px; la fila de acciones, el saludo (lleva al perfil) y los contadores.
export function HomeHeader({
  person,
  business,
  side,
  children,
}: HomeHeaderProps) {
  const name = person.fullName ?? "Persona de la demo";
  return (
    <header className="rounded-b-header bg-surface px-5 pb-7 pt-4 shadow-card md:rounded-header">
      <HomeActions side={side} slug={business.slug} />
      <Link
        href="/pro/perfil"
        aria-label={`Hola, ${name}. Ver mi perfil`}
        className="mt-3 flex items-center gap-4 rounded-card"
      >
        <Avatar className="h-[55px] w-[55px] text-25">
          <AvatarFallback>{name.charAt(0)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="block text-14 text-slate">Hola,</span>
          <span className="block truncate text-25 font-medium text-primary">
            {name}
          </span>
          <span className="block text-12 text-slate">
            {person.roleLabel} · {business.name}
          </span>
        </span>
      </Link>
      {children}
    </header>
  );
}
