import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  message: string;
  /** Un botón, si aplica. */
  action?: ReactNode;
  className?: string;
}

// Estado vacío (DESIGN.md §7): texto gris centrado y, si aplica, un botón. Sin dibujos.
export function EmptyState({ message, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 px-5 py-10 text-center",
        className,
      )}
    >
      <p className="text-14 text-slate">{message}</p>
      {action}
    </div>
  );
}
