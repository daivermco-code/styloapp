"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";
import { useHydrated } from "@/shared/hooks/use-hydrated";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, disabled, ...props }, ref) => {
  // Hasta que React toma la página no cambia (WebKit lo tocaba antes, Auto-Blindaje de la
  // Fase 1): queda desactivado sin cambiar de color.
  const hydrated = useHydrated();
  // Se ve de 36 × 20 (la pista va en ::before), pero se toca en 44 × 44 (US-034); los márgenes
  // negativos lo dejan ocupar lo mismo de antes.
  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer relative -mx-1 -my-3 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full before:absolute before:h-5 before:w-9 before:rounded-full before:shadow-sm before:transition-colors focus-visible:outline-none focus-visible:before:ring-2 focus-visible:before:ring-ring focus-visible:before:ring-offset-2 focus-visible:before:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:before:bg-primary data-[state=unchecked]:before:bg-input",
        !hydrated && "disabled:cursor-default disabled:opacity-100",
        className,
      )}
      disabled={disabled || !hydrated}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none relative block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-2 data-[state=unchecked]:-translate-x-2",
        )}
      />
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
