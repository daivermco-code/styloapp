"use client";

import {
  CalendarDays,
  ChevronRight,
  Heart,
  type LucideIcon,
  Smile,
  Star,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { LoginPrompt } from "./login-prompt";

export interface ClientMenuLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Lo personal del cliente (T-5.2.2 y T-6.3.1), en el orden de US-032. */
export const CLIENT_MENU_LINKS: ClientMenuLink[] = [
  { label: "Perfil", href: "/app/perfil", icon: UserRound },
  { label: "Mis Reservas", href: "/app/reservas", icon: CalendarDays },
  { label: "Negocios seguidos", href: "/app/seguidos", icon: Heart },
  { label: "Mis reseñas", href: "/app/resenas", icon: Star },
  { label: "Mi reputación", href: "/app/reputacion", icon: Smile },
];

interface ClientMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nombre de quien tiene sesión, o null sin sesión. */
  fullName: string | null;
  signedIn: boolean;
  /** A dónde vuelve Entrar sin sesión. */
  next: string;
}

// Menú de la app de clientes (hoja desde abajo): la persona, sus secciones y Cerrar sesión. Sin
// sesión muestra "Mejora tu experiencia".
export function ClientMenu({
  open,
  onOpenChange,
  fullName,
  signedIn,
  next,
}: ClientMenuProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-[720px] pb-8">
        <SheetTitle className="sr-only">Menú</SheetTitle>
        <SheetDescription className="sr-only">
          Tu perfil, tus reservas, los negocios que sigues, tus reseñas y tu
          reputación.
        </SheetDescription>
        {signedIn ? (
          <div className="flex flex-col gap-2 pt-4">
            <p className="flex items-center gap-3 border-b border-line px-5 pb-4">
              <span
                aria-hidden
                className="flex size-11 items-center justify-center rounded-full bg-primary text-18 font-bold text-surface"
              >
                {(fullName ?? "?").charAt(0).toUpperCase()}
              </span>
              <span className="text-18 font-bold text-ink">{fullName}</span>
            </p>
            <nav aria-label="Lo tuyo">
              <ul>
                {CLIENT_MENU_LINKS.map(({ label, href, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => onOpenChange(false)}
                      className="flex min-h-14 items-center gap-4 px-5 text-16 text-ink hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <Icon className="size-6 text-primary" strokeWidth={1.8} />
                      <span className="flex-1">{label}</span>
                      <ChevronRight className="size-5 text-slate" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <SignOutButton variant="ghost" className="mx-5 self-start" />
          </div>
        ) : (
          <LoginPrompt next={next} className="py-10" />
        )}
      </SheetContent>
    </Sheet>
  );
}
