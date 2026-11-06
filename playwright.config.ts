import { defineConfig, devices } from "@playwright/test";

// Los cuatro tamaños de US-034, en Chromium y WebKit.
const SIZES = [
  {
    name: "celular",
    viewport: { width: 411, height: 914 },
    isMobile: true,
    hasTouch: true,
  },
  {
    name: "tableta-vertical",
    viewport: { width: 820, height: 1180 },
    isMobile: false,
    hasTouch: true,
  },
  {
    name: "tableta-horizontal",
    viewport: { width: 1180, height: 820 },
    isMobile: false,
    hasTouch: true,
  },
  {
    name: "computador",
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
  },
] as const;

const BROWSERS = [
  { name: "chromium", device: devices["Desktop Chrome"] },
  { name: "webkit", device: devices["Desktop Safari"] },
] as const;

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  // Todos los flujos usan el mismo Supabase local.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  // Contra el servidor de desarrollo, la primera visita a cada ruta la compila (varios segundos).
  // En WebKit la sola entrada tarda hasta 20 s, así que un flujo largo como la agenda pasa de 30.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "retain-on-failure",
  },
  projects: BROWSERS.flatMap((browser) =>
    SIZES.map((size) => ({
      name: `${browser.name}-${size.name}`,
      use: {
        ...browser.device,
        viewport: size.viewport,
        // WebKit de escritorio no acepta isMobile: solo Chromium emula el celular.
        isMobile: browser.name === "chromium" && size.isMobile,
        hasTouch: size.hasTouch,
      },
    })),
  ),
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
