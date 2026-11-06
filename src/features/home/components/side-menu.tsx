"use client";

import { House, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { StaffSide } from "../types/home";
import {
  type HomeModule,
  OWNER_MENU_SECTIONS,
  SOON_MESSAGE,
  STAFF_SECTIONS,
} from "./module-list";

const ROW =
  "flex min-h-11 w-full items-center gap-3 rounded-card px-3 text-left text-16 text-ink transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function matches(pathname: string, href: string): boolean {
  return href === "/pro"
    ? pathname === "/pro"
    : pathname === href || pathname.startsWith(`${href}/`);
}

// La fila activa es la de la ruta más larga que coincide: en /pro/configurar/equipo se enciende
// Equipo y no también "Configurar negocio".
function activeHref(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((href) => matches(pathname, href))
    .sort((a, b) => b.length - a.length)[0];
}

function MenuRow({
  label,
  icon: Icon,
  href,
  active = false,
}: HomeModule & { active?: boolean }) {
  const content = (
    <>
      <Icon className="size-5 shrink-0 text-primary" strokeWidth={1.8} />
      {label}
    </>
  );
  if (!href) {
    return (
      <button
        type="button"
        onClick={() => toast(SOON_MESSAGE, { id: "pronto" })}
        className={ROW}
      >
        {content}
      </button>
    );
  }
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(ROW, active && "bg-primary-50 font-bold text-primary")}
    >
      {content}
    </Link>
  );
}

const HOME: HomeModule = { label: "Inicio", icon: House, href: "/pro" };

// Menú lateral de computador (desde 1024 px, T-2.1.4): Inicio, los módulos del inicio por
// sección (el dueño también ve Equipo) y, al final, la configuración de cada rol.
export function SideMenu({ side }: { side: StaffSide }) {
  const pathname = usePathname();
  const sections = side === "owner" ? OWNER_MENU_SECTIONS : STAFF_SECTIONS;
  const settings: HomeModule =
    side === "owner"
      ? { label: "Configurar negocio", icon: Settings, href: "/pro/configurar" }
      : {
          label: "Configurar cuenta",
          icon: Settings,
          href: "/pro/configurar/cuenta",
        };
  const rows = [HOME, ...sections.flatMap((s) => s.modules), settings];
  const active = activeHref(
    pathname,
    rows.flatMap((row) => (row.href ? [row.href] : [])),
  );

  return (
    <nav aria-label="Módulos" className="flex flex-col gap-4">
      <MenuRow {...HOME} active={active === HOME.href} />
      {sections.map((section, index) => (
        <div key={section.title ?? index} className="flex flex-col">
          {section.title && (
            <p className="px-3 pb-1 text-14 font-bold text-secondary">
              {section.title}
            </p>
          )}
          <ul>
            {section.modules.map((module) => (
              <li key={module.label}>
                <MenuRow
                  {...module}
                  active={!!module.href && active === module.href}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <MenuRow {...settings} active={active === settings.href} />
    </nav>
  );
}
