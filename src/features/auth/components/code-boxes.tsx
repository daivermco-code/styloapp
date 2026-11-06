"use client";

import {
  type ClipboardEvent,
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

export const CODE_LENGTH = 6;

interface CodeBoxesProps {
  /** Los números escritos, seguidos y sin espacios. */
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
}

// Casillas del código (UI §4): 6 de 44 × 52 px. Se llenan en orden; pegar el código las llena
// todas y borrar vuelve a la anterior.
export function CodeBoxes({
  value,
  onChange,
  invalid,
  disabled,
  describedBy,
}: CodeBoxesProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  // El valor más reciente: al escribir rápido o al autocompletar llegan varias teclas antes de que
  // React vuelva a pintar, y cada una tiene que ver la anterior.
  const latest = useRef(value);
  useLayoutEffect(() => {
    latest.current = value;
  }, [value]);
  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? "");

  const focusBox = (index: number) =>
    refs.current[Math.min(Math.max(index, 0), CODE_LENGTH - 1)]?.focus();

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const update = (next: string) => {
    latest.current = next;
    onChange(next);
  };

  const write = (index: number, text: string) => {
    const typed = text.replace(/\D/g, "");
    if (!typed) return;
    const next = (latest.current.slice(0, index) + typed).slice(0, CODE_LENGTH);
    update(next);
    focusBox(next.length);
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Backspace") return;
    event.preventDefault();
    const from = latest.current[index] ? index : index - 1;
    if (from < 0) return;
    update(latest.current.slice(0, from));
    focusBox(from);
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    write(0, event.clipboardData.getData("text"));
  };

  return (
    <div
      role="group"
      aria-label="Código de 6 números"
      aria-describedby={describedBy}
      className="flex justify-center gap-2"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Número ${index + 1} del código`}
          aria-invalid={invalid ? true : undefined}
          disabled={disabled}
          value={digit}
          onFocus={() => {
            if (index > latest.current.length) focusBox(latest.current.length);
          }}
          onChange={(event) => {
            const own = latest.current[index] ?? "";
            write(index, event.target.value.replace(own, "") || own);
          }}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={onPaste}
          className={cn(
            "h-[52px] w-11 rounded-card border border-stroke bg-surface text-center text-22 font-bold text-ink transition-colors focus:border-2 focus:border-primary focus:outline-none disabled:opacity-50",
            invalid && "border-danger focus:border-danger",
          )}
        />
      ))}
    </div>
  );
}
