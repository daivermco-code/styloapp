"use client";

import { ArchiveRestore, ArchiveX } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { setServiceActive } from "../services/actions";

interface ServiceStateButtonProps {
  id: string;
  name: string;
  /** Si está activo, el botón lo archiva; si no, lo vuelve a activar. */
  active: boolean;
  /** Botón con ícono encima del texto (tarjeta) o en fila (editor). */
  layout?: "stacked" | "inline";
  /** Después de cambiar, ir a esta ruta (el editor vuelve a la lista). */
  then?: string;
}

// "Archivar" y "Activar" de un servicio (US-011).
export function ServiceStateButton({
  id,
  name,
  active,
  layout = "stacked",
  then,
}: ServiceStateButtonProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, startTransition] = useActionTransition();
  const Icon = active ? ArchiveX : ArchiveRestore;
  const text = active ? "Archivar" : "Activar";

  const toggle = () => {
    startTransition(async () => {
      const result = await setServiceActive({ id, active: !active });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        active
          ? `${name} quedó archivado. Lo encuentras en Archivados.`
          : `${name} volvió a Activos.`,
      );
      if (then) router.push(then);
      else router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!hydrated || pending}
      aria-label={layout === "stacked" ? `${text} ${name}` : undefined}
      className={cn(
        "flex items-center rounded-card text-slate transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
        layout === "stacked"
          ? "min-h-11 min-w-16 flex-col justify-center gap-0.5 px-2 py-1 text-14"
          : "min-h-12 justify-center gap-2 px-4 text-16 font-bold",
        pending && "opacity-60",
      )}
    >
      <Icon className="size-5" />
      {layout === "stacked" ? text : `${text} servicio`}
    </button>
  );
}
