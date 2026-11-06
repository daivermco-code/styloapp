import { CircleArrowDown, CircleArrowUp, CircleMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import { variationText, variationTone } from "../lib/display";
import type { Variation as VariationValue } from "../types/report";

interface VariationProps {
  value: VariationValue;
  /** Gastos y Pago de comisiones: subir es mala noticia (rojo). */
  risingIsBad?: boolean;
}

const TONE_CLASS = {
  good: "text-success",
  bad: "text-danger",
  neutral: "text-warning",
  new: "text-primary",
} as const;

/** Lo que dice el lector de pantalla: "Sube 12 % frente al periodo anterior". */
function spoken(value: VariationValue): string {
  if (value.kind === "same") return "Igual que el periodo anterior";
  if (value.kind === "new") return "Nuevo: el periodo anterior estaba en $ 0";
  const verb = value.pct > 0 ? "Sube" : "Baja";
  return `${verb} ${Math.abs(value.pct)} % frente al periodo anterior`;
}

// La variación contra el periodo anterior (T-13.1.1, UI B.1): ícono de 20 px y el % en 14. Verde
// si es buena noticia y rojo si es mala; el círculo con "−" en ámbar para 0 %; "Nuevo" en Bold 14
// principal, sin ícono.
export function Variation({ value, risingIsBad = false }: VariationProps) {
  const tone = variationTone(value, risingIsBad);
  const Icon =
    value.kind === "same"
      ? CircleMinus
      : value.kind === "change" && value.pct > 0
        ? CircleArrowUp
        : CircleArrowDown;
  return (
    <p
      className={cn(
        "flex items-center justify-center gap-1.5 text-14",
        TONE_CLASS[tone],
        tone === "new" && "font-bold",
      )}
    >
      {tone !== "new" && <Icon className="size-5 shrink-0" aria-hidden />}
      <span aria-hidden>{variationText(value)}</span>
      <span className="sr-only">{spoken(value)}</span>
    </p>
  );
}
