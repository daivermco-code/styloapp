import type { ReactNode } from "react";

interface FieldBoxProps {
  /** El id del control: la etiqueta lo nombra y el error queda en `${id}-error`. */
  id: string;
  label: string;
  /** Con *, o "(opcional)" si no. */
  required?: boolean;
  error?: string;
  children: ReactNode;
}

// Un campo de formulario: la etiqueta en Bold 14 (con * o "(opcional)"), el control y, debajo,
// el error en rojo que el control nombra con aria-describedby (Gastos y Pagar).
export function FieldBox({
  id,
  label,
  required,
  error,
  children,
}: FieldBoxProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-14 font-bold text-ink">
        {label}
        {required ? (
          <span aria-hidden="true"> *</span>
        ) : (
          <span className="font-medium text-slate"> (opcional)</span>
        )}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-14 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
