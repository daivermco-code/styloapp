import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Sin esto, tailwind-merge toma los tamaños propios (text-16) por colores y borra el color
// del texto (text-primary-foreground). La escala es la de tailwind.config.ts.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "10",
            "11",
            "12",
            "13",
            "14",
            "15",
            "16",
            "17",
            "18",
            "20",
            "22",
            "25",
            "30",
          ],
        },
      ],
    },
  },
});

/** Une clases de Tailwind sin choques (la usan los componentes de shadcn/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
