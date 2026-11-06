"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface MoneyInputProps {
  id?: string;
  /** Pesos enteros; null, el campo vacío. */
  value: number | null;
  onChange: (value: number | null) => void;
  /** Al salir del campo (para mostrar su error), después de volver al punto de miles. */
  onBlur?: () => void;
  disabled?: boolean;
  /** Se anuncia como obligatorio a los lectores de pantalla. */
  required?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

/** Con punto de miles: 25000 → "25.000". */
function withThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Campo de dinero (UI A.1, T-8.3.1): "$" fijo a la izquierda, teclado numérico y el valor con
// punto de miles al salir del campo. Mientras se escribe muestra solo los dígitos.
export function MoneyInput({
  value,
  onChange,
  onBlur,
  disabled,
  required,
  invalid,
  className,
  ...props
}: MoneyInputProps) {
  const [editing, setEditing] = useState(false);
  /** Si ya se escribió algo desde que se entró al campo: entonces no se vuelve a seleccionar. */
  const typed = useRef(false);
  const text =
    value === null ? "" : editing ? String(value) : withThousands(value);

  return (
    <div className={cn("relative", className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-16 text-slate"
      >
        $
      </span>
      <Input
        {...props}
        value={text}
        inputMode="numeric"
        autoComplete="off"
        maxLength={11}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        aria-required={required ? true : undefined}
        onFocus={(event) => {
          setEditing(true);
          // Al entrar, "25.000" pasa a "25000" y el navegador pierde la selección: se vuelve a
          // seleccionar todo para que escribir reemplace el valor y no se pegue al final. Si ya
          // se escribió en ese cuadro, no: seleccionar borraría lo que se acaba de escribir.
          typed.current = false;
          const input = event.currentTarget;
          requestAnimationFrame(() => {
            if (document.activeElement === input && !typed.current) {
              input.select();
            }
          });
        }}
        onBlur={() => {
          setEditing(false);
          onBlur?.();
        }}
        onChange={(event) => {
          typed.current = true;
          const digits = event.target.value.replace(/\D/g, "").slice(0, 9);
          onChange(digits === "" ? null : Number(digits));
        }}
        className="pl-9 text-right"
      />
    </div>
  );
}
