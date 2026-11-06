import { describe, expect, it } from "vitest";
import {
  canChangeInvoice,
  type ChangeTarget,
  type ChangeViewer,
  commissionLabel,
  invoicePayouts,
  payoutText,
  voidedText,
} from "@/features/invoices/lib/detail";
import { INVOICE_PAID_OUT } from "@/features/invoices/types/messages";

// T-8.2.2 (US-043): las reglas del detalle de una factura.
const OWNER: ChangeViewer = {
  side: "owner",
  staffId: "dueno",
  canInvoice: true,
};
const CAMILO: ChangeViewer = {
  side: "staff",
  staffId: "camilo",
  canInvoice: true,
};
const OPEN: ChangeTarget = {
  status: "paid",
  paidOut: false,
  allMine: true,
};

describe("invoicePayouts", () => {
  it("deja un pago por cada pago, aunque cubra varios servicios", () => {
    const payment = { paidOn: "2026-11-01", staffName: "Camilo" };
    expect(
      invoicePayouts([
        { staffPaymentId: "p1", staffName: "Camilo", payment },
        { staffPaymentId: "p1", staffName: "Camilo", payment },
        { staffPaymentId: null, staffName: "Sofía", payment: null },
      ]),
    ).toEqual([{ key: "p1", staffName: "Camilo", paidOn: "2026-11-01" }]);
  });

  it("sin el pago a la vista (el profesional), queda sin día", () => {
    expect(
      invoicePayouts([
        { staffPaymentId: "p2", staffName: "Julián", payment: null },
      ]),
    ).toEqual([{ key: "p2", staffName: "Julián", paidOn: null }]);
  });

  it("sin pagos, vacío", () => {
    expect(
      invoicePayouts([
        { staffPaymentId: null, staffName: "Camilo", payment: null },
      ]),
    ).toEqual([]);
  });
});

describe("textos del detalle", () => {
  it("dice a quién y cuándo se pagó", () => {
    expect(
      payoutText({ key: "p1", staffName: "Camilo", paidOn: "2026-11-01" }),
    ).toBe("Pagada a Camilo el 1 nov");
  });

  it("sin el día del pago, usa el aviso de la historia", () => {
    expect(payoutText({ key: "p2", staffName: "Julián", paidOn: null })).toBe(
      INVOICE_PAID_OUT,
    );
  });

  it("dice quién y cuándo anuló, con lo que se sepa", () => {
    // 2026-11-02 03:00 UTC es todavía el 1 de noviembre en Bogotá.
    expect(voidedText("Camilo", "2026-11-02T03:00:00Z")).toBe(
      "Anulada por Camilo el 1 nov",
    );
    expect(voidedText(null, "2026-11-02T03:00:00Z")).toBe("Anulada el 1 nov");
    expect(voidedText("Camilo", null)).toBe("Anulada por Camilo");
    expect(voidedText(null, null)).toBeNull();
  });

  it("escribe la comisión con coma decimal", () => {
    expect(commissionLabel(50)).toBe("comisión 50 %");
    expect(commissionLabel(37.5)).toBe("comisión 37,5 %");
  });
});

describe("canChangeInvoice", () => {
  it("el dueño edita y anula una pagada sin pagos al profesional", () => {
    expect(canChangeInvoice(OWNER, OPEN)).toBe(true);
  });

  it("nadie cambia una anulada ni una que ya entró en un pago", () => {
    expect(canChangeInvoice(OWNER, { ...OPEN, status: "void" })).toBe(false);
    expect(canChangeInvoice(OWNER, { ...OPEN, paidOut: true })).toBe(false);
    expect(canChangeInvoice(CAMILO, { ...OPEN, paidOut: true })).toBe(false);
  });

  it("el profesional, con el permiso y todos los servicios a su nombre", () => {
    expect(canChangeInvoice(CAMILO, OPEN)).toBe(true);
    expect(canChangeInvoice({ ...CAMILO, canInvoice: false }, OPEN)).toBe(
      false,
    );
  });

  it("con un servicio de otro, aunque la RLS lo esconda y sea de $ 0, el profesional no", () => {
    expect(canChangeInvoice(CAMILO, { ...OPEN, allMine: false })).toBe(false);
    // El dueño sí: no depende de quién hizo los servicios.
    expect(canChangeInvoice(OWNER, { ...OPEN, allMine: false })).toBe(true);
  });
});
