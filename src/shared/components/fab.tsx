"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/shared/hooks/use-hydrated";

const FAB_CLASSES =
  "fixed bottom-4 right-4 z-30 flex h-[55px] w-[55px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card transition duration-120 ease-out hover:bg-primary-700 active:scale-[0.98] [&_svg]:size-7";
const EXTENDED_CLASSES = "w-auto gap-2 px-6 text-16 font-bold [&_svg]:size-6";

type FabProps = {
  /** Lo que hace, para lectores de pantalla ("Agendar una cita"). */
  label: string;
  icon: ReactNode;
  /** Pastilla con el texto a la vista ("Crear servicio"), en vez del círculo. */
  extended?: boolean;
  className?: string;
} & (
  | { href: string; onClick?: never }
  | ({ href?: never } & Pick<ComponentProps<"button">, "onClick">)
);

// Botón flotante (DESIGN.md §4): círculo de 55 px, principal, a 16 px del borde derecho y del de
// abajo. Lleva a una página (href) o hace una acción (onClick).
export function Fab({
  label,
  icon,
  extended = false,
  className,
  href,
  onClick,
}: FabProps) {
  const hydrated = useHydrated();
  const classes = cn(FAB_CLASSES, extended && EXTENDED_CLASSES, className);
  const content = extended ? (
    <>
      {icon}
      {label}
    </>
  ) : (
    icon
  );
  const ariaLabel = extended ? undefined : label;
  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={classes}>
        {content}
      </Link>
    );
  }
  // La acción vive en React: antes de que tome la página, el toque se perdería.
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={!hydrated}
      className={cn(classes, "disabled:cursor-default")}
    >
      {content}
    </button>
  );
}
