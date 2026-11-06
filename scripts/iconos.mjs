// Genera los íconos de la app instalable (Fase 11, T-11.1.1) a partir del monograma de la marca.
// Correr con `node scripts/iconos.mjs` si cambia public/brand/monograma.svg; los PNG quedan en git.
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const BRAND = "#0E7C74";
const monogram = await readFile("public/brand/monograma.svg", "utf8");
// Solo la S y el punto, sin el cuadro de fondo.
const glyph = monogram
  .replace(/<svg[^>]*>/, "")
  .replace("</svg>", "")
  .replace(/<rect[^>]*\/>/, "");

/** El monograma sobre un cuadrado entero de la marca, con `pad` unidades de aire alrededor. */
function squareSvg(pad) {
  const side = 40 + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${side} ${side}">
  <rect x="${-pad}" y="${-pad}" width="${side}" height="${side}" fill="${BRAND}"/>${glyph}</svg>`;
}

async function png(svg, size, file) {
  await sharp(Buffer.from(svg), { density: 1200 })
    .resize(size, size)
    .png()
    .toFile(file);
  console.log(`${file} (${size} px)`);
}

// "any": el monograma redondeado, como en la marca.
await png(monogram, 192, "public/brand/icono-192.png");
await png(monogram, 512, "public/brand/icono-512.png");
// "maskable": Android lo recorta en círculo o gota; la S queda dentro del 80 % del centro.
await png(squareSvg(5), 512, "public/brand/icono-maskable-512.png");
// iPhone: cuadrado sin transparencia; iOS le pone las esquinas.
await png(squareSvg(4), 180, "src/app/apple-icon.png");
