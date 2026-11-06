import type { NextConfig } from "next";

// La versión del service worker (Fase 11): cambia en cada publicación de Vercel y en cada build local, para
// que la versión nueva reemplace la anterior y borre sus cachés.
const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now());

const nextConfig: NextConfig = {
  // Activa el MCP server en /_next/mcp (Next.js 16+)
  experimental: {
    mcpServer: true,
  },
  // El indicador de desarrollo tapaba el botón de la bandeja (abajo a la izquierda). Los errores
  // de compilación y de ejecución se siguen mostrando.
  devIndicators: false,
  env: { NEXT_PUBLIC_APP_VERSION: APP_VERSION },
  async headers() {
    return [
      {
        // El navegador siempre pide el service worker nuevo y solo deja correr código de la app.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
  async rewrites() {
    // La página sin conexión es estática (public/sin-conexion.html) y se abre en /sin-conexion.
    return [{ source: "/sin-conexion", destination: "/sin-conexion.html" }];
  },
};

export default nextConfig;
