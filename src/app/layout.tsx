import type { Metadata, Viewport } from "next";
import { Quicksand } from "next/font/google";
import { getCurrentPerson } from "@/features/auth/services/queries";
import { InboxButton } from "@/features/demo/components/inbox-button";
import { personInboxLabel } from "@/features/demo/services/inbox-label";
import { BrandToaster } from "@/shared/components/brand-toaster";
import { InstantNavProvider } from "@/shared/components/instant-nav";
import { OfflineBanner } from "@/shared/components/offline-banner";
import { ServiceWorker } from "@/shared/components/service-worker";
import pantallasIos from "@/shared/lib/arranque-ios.json";
import "./globals.css";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-quicksand",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "StyloApp", template: "%s · StyloApp" },
  description:
    "Demo local de una app de agenda para barberías y salones en Colombia.",
  // Instalada en el iPhone abre sin la barra del navegador (Fase 11); el ícono es src/app/apple-icon.png.
  appleWebApp: {
    capable: true,
    title: "StyloApp",
    statusBarStyle: "default",
    // Lo que muestra el iPhone al abrir la app instalada, antes de que llegue la página (sin esto, negro).
    // Las imágenes las hace `scripts/imagenes-arranque.mjs`; no hay otra bienvenida dentro de la página.
    startupImage: pantallasIos.map(({ ancho, alto, escala }) => ({
      url: `/brand/arranque/arranque-${ancho * escala}x${alto * escala}.png`,
      media: `(device-width: ${ancho}px) and (device-height: ${alto}px) and (-webkit-device-pixel-ratio: ${escala}) and (orientation: portrait)`,
    })),
  },
  // Next 16 solo pone `mobile-web-app-capable`; sin la de Apple, el iPhone no usa las imágenes de arranque y abre
  // en negro.
  other: { "apple-mobile-web-app-capable": "yes" },
};

// La barra del sistema sigue el modo (Fase 16): el verde de la marca de día y el petróleo de noche
// (DESIGN.md §2.1). El manifiesto se queda con el verde: no admite un color por modo.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0E7C74" },
    { media: "(prefers-color-scheme: dark)", color: "#183A36" },
  ],
  // Campos nativos (fecha, hora, listas) y barras de desplazamiento en el modo del sistema.
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

// El botón de la bandeja va en todas las zonas (US-004); cambia de dueño al entrar o salir.
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const person = await getCurrentPerson();

  return (
    <html lang="es-CO" className={quicksand.variable}>
      <body>
        <OfflineBanner />
        <InstantNavProvider>{children}</InstantNavProvider>
        <InboxButton
          key={person?.phone ?? "sin-sesion"}
          phone={person?.phone ?? null}
          personLabel={person ? personInboxLabel(person) : null}
          side={person?.side ?? null}
        />
        <BrandToaster />
        <ServiceWorker />
      </body>
    </html>
  );
}
