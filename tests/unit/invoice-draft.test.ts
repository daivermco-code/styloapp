import { describe, expect, it } from "vitest";
import type {
  BookingCategoryOption,
  BookingServiceOption,
} from "@/features/agenda/types/agenda";
import {
  bookingLabel,
  type ChangeTarget,
} from "@/features/invoices/lib/detail";
import {
  commissionKey,
  commissionOf,
  type DraftItem,
  draftTotals,
  editBlockReason,
  proposedItem,
  type SeedService,
  withSeedServices,
} from "@/features/invoices/lib/draft";
import {
  INVOICE_PAID_OUT,
  INVOICE_VOIDED,
  NOT_OWN_INVOICE,
} from "@/features/invoices/types/messages";

// T-8.3.1 y T-8.3.2 (US-040, US-041 y US-043): las cuentas del editor de factura.
const CORTE: BookingServiceOption = {
  id: "corte",
  name: "Corte clásico",
  priceLabel: "$ 25.000",
  durationMinutes: 30,
  staff: [
    { id: "camilo", name: "Camilo", durationMinutes: 30, price: 25000 },
    { id: "sofia", name: "Sofía", durationMinutes: 40, price: 30000 },
  ],
};
const NADIE: BookingServiceOption = { ...CORTE, id: "nadie", staff: [] };
const CATALOGO: BookingCategoryOption[] = [
  { id: "cortes", name: "Cortes", services: [CORTE] },
];

function item(change: Partial<DraftItem> = {}): DraftItem {
  return {
    serviceId: "corte",
    serviceName: "Corte clásico",
    staffId: "camilo",
    staffName: "Camilo",
    price: 25000,
    ...change,
  };
}

describe("proposedItem", () => {
  it("propone el primer profesional con su precio", () => {
    expect(proposedItem(CORTE)).toEqual(item());
  });

  it("con otro profesional, propone el precio de ese", () => {
    expect(proposedItem(CORTE, "sofia")).toEqual(
      item({ staffId: "sofia", staffName: "Sofía", price: 30000 }),
    );
  });

  it("si el profesional no hace el servicio, vuelve al primero", () => {
    expect(proposedItem(CORTE, "otro")?.staffId).toBe("camilo");
  });

  it("sin nadie que lo haga, no propone nada", () => {
    expect(proposedItem(NADIE)).toBeNull();
  });
});

describe("draftTotals", () => {
  it("suma el total y la comisión con el porcentaje de cada uno", () => {
    const commissions = { [commissionKey("camilo", "corte")]: 40 };
    expect(
      draftTotals(
        [item(), item({ serviceId: "barba", price: 15000 })],
        commissions,
      ),
    ).toEqual({ total: 40000, commission: 10000 + 7500 });
  });

  it("un valor vacío cuenta como cero", () => {
    expect(draftTotals([item({ price: null })], {})).toEqual({
      total: 0,
      commission: 0,
    });
  });

  it("sin los porcentajes (el profesional) no da la comisión", () => {
    expect(draftTotals([item()], null)).toEqual({
      total: 25000,
      commission: null,
    });
  });

  it("redondea la comisión como la base, sin errores de coma flotante", () => {
    expect(commissionOf(25001, 50)).toBe(12501);
    expect(commissionOf(5000, 2.01)).toBe(101);
    expect(commissionOf(5000, 0.57)).toBe(29);
    expect(commissionOf(0, 40)).toBe(0);
  });
});

describe("withSeedServices", () => {
  const seed = (change: Partial<SeedService> = {}): SeedService => ({
    serviceId: "corte",
    serviceName: "Corte clásico",
    staffId: "camilo",
    staffName: "Camilo",
    price: 25000,
    ...change,
  });

  it("sin nada nuevo, deja el catálogo igual", () => {
    expect(withSeedServices(CATALOGO, [seed()])).toEqual(CATALOGO);
  });

  it("suma al servicio el profesional que ya no lo hace", () => {
    const [cortes] = withSeedServices(CATALOGO, [
      seed({ staffId: "julian", staffName: "Julián", price: 20000 }),
    ]);
    expect(cortes.services[0].staff.map((s) => s.id)).toEqual([
      "camilo",
      "sofia",
      "julian",
    ]);
  });

  it("un servicio archivado va en «En esta factura» con sus profesionales", () => {
    const merged = withSeedServices(CATALOGO, [
      seed({ serviceId: "viejo", serviceName: "Afeitado" }),
      seed({ serviceId: "viejo", serviceName: "Afeitado", staffId: "sofia" }),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[1].name).toBe("En esta factura");
    expect(merged[1].services).toHaveLength(1);
    expect(merged[1].services[0].staff.map((s) => s.id)).toEqual([
      "camilo",
      "sofia",
    ]);
  });
});

describe("editBlockReason", () => {
  const OPEN: ChangeTarget = {
    status: "paid",
    paidOut: false,
    allMine: true,
  };
  const OWNER = { side: "owner" as const, staffId: "dueno", canInvoice: true };
  const CAMILO = {
    side: "staff" as const,
    staffId: "camilo",
    canInvoice: true,
  };

  it("anulada o ya pagada al profesional, no se edita", () => {
    expect(editBlockReason(OWNER, { ...OPEN, status: "void" })).toBe(
      INVOICE_VOIDED,
    );
    expect(editBlockReason(OWNER, { ...OPEN, paidOut: true })).toBe(
      INVOICE_PAID_OUT,
    );
  });

  it("el dueño edita cualquiera y el profesional las suyas", () => {
    expect(editBlockReason(OWNER, OPEN)).toBeNull();
    expect(editBlockReason(CAMILO, OPEN)).toBeNull();
  });

  it("con servicios de otro, el profesional no la edita", () => {
    expect(editBlockReason(CAMILO, { ...OPEN, allMine: false })).toBe(
      NOT_OWN_INVOICE,
    );
    expect(editBlockReason(OWNER, { ...OPEN, allMine: false })).toBeNull();
  });
});

describe("bookingLabel", () => {
  it("dice el día corto con mayúscula y la hora de Bogotá", () => {
    expect(bookingLabel("2026-10-31T16:00:00Z")).toBe(
      "Sáb 31 oct · 11:00 a. m.",
    );
  });
});
