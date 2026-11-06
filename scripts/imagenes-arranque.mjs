// Imágenes de arranque del iPhone y el iPad (apple-touch-startup-image): lo que muestra iOS al abrir la app
// instalada, antes de que llegue la página. Sin ellas sale una pantalla negra. iOS la deja hasta que la página se
// pinta y de ahí pasa directo a la app: no hay otra bienvenida dentro de la página (con una encima se ven "dos
// logos" y el destello blanco que pone iOS en ese cambio, bug de WebKit 311569). Es el monograma en blanco hueso
// sobre el verde petróleo de la marca, con "StyloApp" debajo, centrado en lo que queda bajo la barra de estado
// (`barra`, alto aproximado de cada modelo): con statusBarStyle "default" la página empieza debajo de ella.
// Uso: `node scripts/imagenes-arranque.mjs` (necesita internet para Quicksand). Las imágenes van a
// `public/brand/arranque/`, que el proxy deja pasar sin sesión. iOS las guarda al agregar la app a la pantalla de
// inicio: para ver un cambio, quitar la app del iPhone y volver a agregarla desde Safari.
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const MARCA = "#0E7C74";
const HUESO = "#FCFEFE";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const pantallas = JSON.parse(
  readFileSync(join(raiz, "src/shared/lib/arranque-ios.json"), "utf8"),
);
const destino = join(raiz, "public/brand/arranque");
mkdirSync(destino, { recursive: true });

// El monograma de public/brand/monograma.svg con los colores al revés, para que se vea sobre el verde.
const html = `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@500;700&display=block" rel="stylesheet">
<style>
  html { margin: 0; height: 100%; background: ${MARCA}; }
  body { position: fixed; top: var(--barra); left: 0; right: 0; bottom: 0; margin: 0;
         display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
         font-family: Quicksand, sans-serif; color: ${HUESO}; }
  svg { width: 88px; height: 88px; }
  span { font-size: 30px; line-height: 1.3; }
  b { font-weight: 700; }
  i { font-style: normal; font-weight: 500; }
</style></head><body>
<svg viewBox="0 0 40 40">
  <rect width="40" height="40" rx="11" fill="${HUESO}"/>
  <path d="M27 13.5c-1.4-2-3.9-3-6.8-3-4 0-6.7 2.1-6.7 5.1 0 6.6 13.8 3.6 13.8 10.3 0 3.2-2.9 5.6-7.2 5.6-3.3 0-6-1.3-7.4-3.6"
        fill="none" stroke="${MARCA}" stroke-width="3.4" stroke-linecap="round"/>
  <circle cx="29.5" cy="29.5" r="2.2" fill="${MARCA}"/>
</svg>
<span><b>Stylo</b><i>App</i></span>
</body></html>`;

const navegador = await chromium.launch();
for (const pantalla of pantallas) {
  const pagina = await navegador.newPage({
    viewport: { width: pantalla.ancho, height: pantalla.alto },
    deviceScaleFactor: pantalla.escala,
  });
  await pagina.setContent(html, { waitUntil: "networkidle" });
  await pagina.evaluate(async (barra) => {
    document.documentElement.style.setProperty("--barra", `${barra}px`);
    await document.fonts.ready;
  }, pantalla.barra);
  const fuente = await pagina.evaluate(() =>
    document.fonts.check('700 30px "Quicksand"'),
  );
  if (!fuente) throw new Error("No cargó Quicksand: revisa la conexión.");
  const archivo = `arranque-${pantalla.ancho * pantalla.escala}x${pantalla.alto * pantalla.escala}.png`;
  await pagina.screenshot({ path: join(destino, archivo) });
  await pagina.close();
  console.log(archivo);
}
await navegador.close();
