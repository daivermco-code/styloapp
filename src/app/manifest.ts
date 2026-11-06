import type { MetadataRoute } from "next";

// La app instalable (Fase 11, T-11.1.1). Colores de DESIGN.md: verde de la marca.
// `background_color` es el fondo con el que Android abre la app instalada (ícono y nombre encima): el verde de
// la marca, como las imágenes de arranque del iPhone (`scripts/imagenes-arranque.mjs`).
// Los íconos salen del monograma con `node scripts/iconos.mjs`.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StyloApp",
    short_name: "StyloApp",
    description: "Agenda para barberías y salones en Colombia.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    lang: "es-CO",
    dir: "ltr",
    background_color: "#0E7C74",
    theme_color: "#0E7C74",
    icons: [
      {
        src: "/brand/icono-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icono-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icono-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
