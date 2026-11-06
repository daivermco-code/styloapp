import { ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "./brand-logo";

interface TopBarProps {
  title: string;
  /** Ícono antes del título (el calendario de la agenda). */
  icon?: ReactNode;
  /** Flecha atrás gris a la izquierda. */
  backHref?: string;
  /** La flecha como botón, para preguntar antes de salir (editor de factura). */
  onBack?: () => void;
  /** La flecha de onBack apagada (antes de hidratar). */
  backDisabled?: boolean;
  /** De 0 a 2 íconos de acción a la derecha. */
  actions?: ReactNode;
  className?: string;
}

// Barra superior de la app del negocio (DESIGN.md §4): 56 px, flecha atrás gris, título Bold 20
// principal centrado hasta dos líneas, acciones a la derecha, sobre blanco hueso.
export function TopBar({
  title,
  icon,
  backHref,
  onBack,
  backDisabled,
  actions,
  className,
}: TopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 grid min-h-14 grid-cols-[44px_1fr_auto] items-center gap-2 bg-surface px-3 shadow-card",
        className,
      )}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={backDisabled}
          aria-label="Volver"
          className="flex h-11 w-11 items-center justify-center rounded-full text-slate hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
        >
          <ArrowLeft className="size-6" />
        </button>
      ) : backHref ? (
        <Link
          href={backHref}
          aria-label="Volver"
          className="flex h-11 w-11 items-center justify-center rounded-full text-slate hover:bg-primary-50"
        >
          <ArrowLeft className="size-6" />
        </Link>
      ) : (
        <span />
      )}
      <h1 className="flex items-center justify-center gap-2 text-center text-20 font-bold text-primary focus:outline-none">
        {icon && (
          <span aria-hidden className="shrink-0 [&_svg]:size-6">
            {icon}
          </span>
        )}
        <span className="line-clamp-2">{title}</span>
      </h1>
      <div className="flex min-w-11 items-center justify-end gap-1 text-primary">
        {actions}
      </div>
    </header>
  );
}

interface ClientTopBarProps {
  title: string;
  /** Botón de la derecha; por defecto, Mis citas. */
  action?: ReactNode;
  className?: string;
}

// Barra superior de la app de clientes: monograma a la izquierda (en computador ya está en el menú
// lateral), título en petróleo profundo y el botón de Mis citas a la derecha.
export function ClientTopBar({ title, action, className }: ClientTopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex min-h-14 items-center gap-3 bg-surface px-4 shadow-card",
        className,
      )}
    >
      <BrandLogo size={34} withName={false} className="lg:hidden" />
      <h1 className="flex-1 truncate text-20 font-bold text-secondary">
        {title}
      </h1>
      {action ?? (
        <Link
          href="/app/reservas"
          className="-mr-2 flex min-h-11 min-w-11 flex-col items-center justify-center rounded-card px-2 text-11 font-bold text-primary hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CalendarDays className="size-6" strokeWidth={1.8} aria-hidden />
          Mis citas
        </Link>
      )}
    </header>
  );
}
