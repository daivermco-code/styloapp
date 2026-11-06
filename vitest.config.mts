import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/db/**/*.test.ts"],
    environment: "node",
    // Las llaves del Supabase local (.env.local) para las pruebas de base.
    env: loadEnv("test", process.cwd(), ""),
    // Las pruebas de base comparten un solo Supabase local: una a la vez.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    // Las reglas puras de la agenda y de Explorar van al 100 % (Blueprint, Fases 3 y 5), y también
    // los periodos y las cuentas de Facturas (Fase 8, T-8.1.1, T-8.2.1 y T-8.2.2) y
    // de Gastos y del Liquidador (Fase 9, T-9.1.1 a T-9.3.1), y las pestañas de Clientes
    // (Fase 10, T-10.1.1), y el error de la red al guardar (Fase 11, T-11.2.1), y los rangos y
    // las cuentas de Informes (Fase 12, T-12.2.1): npm run test:coverage.
    coverage: {
      provider: "v8",
      include: [
        "src/features/agenda/lib/**",
        "src/features/explore/lib/**",
        "src/shared/lib/periods.ts",
        "src/features/invoices/lib/totals.ts",
        "src/features/invoices/lib/filters.ts",
        "src/features/invoices/lib/detail.ts",
        "src/features/invoices/lib/draft.ts",
        "src/features/expenses/lib/**",
        "src/features/payroll/lib/**",
        "src/features/clients/lib/**",
        "src/shared/lib/network-error.ts",
        "src/features/reports/lib/**",
      ],
      thresholds: { 100: true },
    },
  },
});
