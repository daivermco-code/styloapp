import * as React from "react";

import { cn } from "@/lib/utils";

// DESIGN.md §4: alto 48 px, borde de 1 px gris de borde, esquinas de 10 px, fondo blanco hueso;
// con foco, borde de 2 px principal sin brillo; con error (aria-invalid), borde rojo.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-card border border-input bg-surface px-4 text-16 text-ink transition-colors placeholder:text-slate focus-visible:border-2 focus-visible:border-primary focus-visible:px-[15px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
