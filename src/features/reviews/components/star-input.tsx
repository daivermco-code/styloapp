"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

// Una fila de cinco estrellas de 36 px para calificar (US-030): cada estrella es una opción del
// grupo y se llenan hasta la elegida.
export function StarInput({
  label,
  value,
  onChange,
  disabled,
}: StarInputProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-center text-16 text-ink">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex gap-1">
        {Array.from({ length: 5 }, (_, index) => {
          const stars = index + 1;
          return (
            <button
              key={stars}
              type="button"
              role="radio"
              aria-checked={stars === value}
              aria-label={stars === 1 ? "1 estrella" : `${stars} estrellas`}
              disabled={disabled}
              onClick={() => onChange(stars)}
              className="flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
            >
              <Star
                aria-hidden
                className={cn(
                  "size-9 text-warning transition-colors duration-120",
                  stars <= value && "fill-warning",
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
