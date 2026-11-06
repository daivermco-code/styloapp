import type { BusinessKind } from "../types/explore";

export interface WorkSample {
  src: string;
  caption: string;
}

// Muestras de trabajo de la página del negocio (US-026): imágenes fijas de la demo, ilustraciones
// propias en public/demo/muestras, según el tipo de negocio. Las muestras con fotos de cada
// negocio son de la oleada 6.
const CAPTIONS: Record<BusinessKind, string[]> = {
  barbershop: [
    "Corte fade",
    "Barba perfilada",
    "Fade con barba",
    "Corte clásico",
  ],
  nail_spa: [
    "Semipermanente",
    "Diseño bicolor",
    "Esmalte vino",
    "Colores de temporada",
  ],
  salon: ["Corte largo", "Color cobrizo", "Recogido", "Cepillado"],
  spa: [
    "Piedras calientes",
    "Aromaterapia",
    "Sala de masajes",
    "Facial con hierbas",
  ],
};

export function workSamples(kind: BusinessKind): WorkSample[] {
  return CAPTIONS[kind].map((caption, index) => ({
    src: `/demo/muestras/${kind}-${index + 1}.svg`,
    caption,
  }));
}
