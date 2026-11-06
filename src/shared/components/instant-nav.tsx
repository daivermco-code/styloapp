"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ComponentProps,
  createContext,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
} from "react";
import { cn } from "@/lib/utils";
import {
  isSelected,
  paramOf,
  type PendingRequest,
} from "@/shared/lib/instant-nav";

// Respuesta inmediata (Fase 17, T-17.1.1). Los controles que cambian algo dentro de la misma
// pantalla (vista, día, periodo, pestaña, profesional, filtros) guardan su estado en la dirección.
// Next no cambia nada hasta que el servidor responde (el loading.tsx solo sale al cambiar de
// sección), y el control se pinta según la dirección: parece paralizado. Aquí se navega con una
// transición de React: el control se ve elegido al tocarlo y la parte que depende del servidor
// muestra su esqueleto mientras llega. Si se toca otro antes, gana el último.

interface InstantNav {
  /** Lo pedido mientras la pantalla nueva no ha llegado; null si no se espera nada. */
  pending: PendingRequest | null;
  /**
   * Va a la dirección sin dejar de responder: `group` dice qué controles la pidieron. Reemplaza la
   * entrada del historial, salvo con `push` (abrir una cita: Atrás la cierra).
   */
  navigate: (href: string, group: string, push?: boolean) => void;
}

const InstantNavContext = createContext<InstantNav | null>(null);

export function InstantNavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [request, setRequest] = useState<PendingRequest | null>(null);
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback(
    (href: string, group: string, push = false) => {
      setRequest({ href, group });
      startTransition(() =>
        push
          ? router.push(href, { scroll: false })
          : router.replace(href, { scroll: false }),
      );
    },
    [router],
  );
  const value = useMemo(
    () => ({ pending: isPending ? request : null, navigate }),
    [isPending, request, navigate],
  );

  return (
    <InstantNavContext.Provider value={value}>
      {children}
    </InstantNavContext.Provider>
  );
}

export function useInstantNav(): InstantNav {
  const context = useContext(InstantNavContext);
  if (!context) throw new Error("Falta InstantNavProvider en el layout raíz");
  return context;
}

/** La dirección que espera este grupo, o null. */
export function usePendingHref(group: string): string | null {
  const { pending } = useInstantNav();
  return pending?.group === group ? pending.href : null;
}

type InstantLinkProps = Omit<
  ComponentProps<typeof Link>,
  "href" | "className" | "replace" | "scroll" | "onClick"
> & {
  href: string;
  /** Los controles que se excluyen entre sí (las pestañas de una fila, los periodos…). */
  group: string;
  /** Si es el elegido según el servidor. */
  selected?: boolean;
  className?: string;
  /** Clases del elegido y del que no lo está; mientras espera, cambian al tocar. */
  selectedClassName?: string;
  idleClassName?: string;
  /** Lo que haga falta antes de navegar (cancelar una búsqueda pendiente). */
  onNavigate?: () => void;
  /** false en lo que no queda elegido (las flechas del periodo): nunca lleva `aria-current`. */
  selectable?: boolean;
  /** Agrega una entrada al historial en vez de reemplazarla. */
  push?: boolean;
};

/**
 * Enlace que responde al tocarlo: se ve elegido de una (`aria-current`, con el que los hijos
 * pueden pintarse con `group-aria-[current=page]:`) y navega en una transición. Con Ctrl, Cmd o
 * Mayús se abre como un enlace normal.
 */
export function InstantLink({
  href,
  group,
  selected = false,
  className,
  selectedClassName,
  idleClassName,
  onNavigate,
  selectable = true,
  push = false,
  ...props
}: InstantLinkProps) {
  const { pending, navigate } = useInstantNav();
  const shown = selectable && isSelected(selected, href, group, pending);

  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    onNavigate?.();
    navigate(href, group, push);
  };

  return (
    <Link
      {...props}
      href={href}
      replace={!push}
      scroll={false}
      onClick={click}
      aria-current={shown ? "page" : undefined}
      className={cn(className, shown ? selectedClassName : idleClassName)}
    />
  );
}

interface PendingAreaProps {
  /** Los grupos de controles que cambian esta parte (otros, como abrir una ventana, no la tapan). */
  groups: readonly string[];
  /** El esqueleto mientras llega. */
  fallback: ReactNode;
  /**
   * Un esqueleto distinto según un parámetro de lo pedido: { param: "vista", fallbacks: { lista:
   * <ListSkeleton /> } }. Si el valor no está, sale `fallback`.
   */
  byParam?: { param: string; fallbacks: Record<string, ReactNode> };
  children: ReactNode;
}

/** La parte de la pantalla que depende del servidor: mientras un grupo suyo espera, su esqueleto. */
export function PendingArea({
  groups,
  fallback,
  byParam,
  children,
}: PendingAreaProps) {
  const { pending } = useInstantNav();
  if (!pending || !groups.includes(pending.group)) return children;
  const value = byParam ? paramOf(pending.href, byParam.param) : null;
  return (value !== null && byParam?.fallbacks[value]) || fallback;
}
