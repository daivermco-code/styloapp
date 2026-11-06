import { z } from "zod";

// Lo que reciben las acciones de Facturas (Tech Spec O4.4). La base vuelve a revisar todo en
// save_invoice y void_invoice.

const MISSING_INVOICE = "Falta la factura.";

/** Anular una factura (T-8.2.2, US-043). */
export const voidInvoiceSchema = z.object({
  invoiceId: z.uuid(MISSING_INVOICE),
});
export type VoidInvoiceInput = z.infer<typeof voidInvoiceSchema>;

export const BOOKING_GONE = "Esta cita ya no existe.";
export const NO_ITEMS = "Agrega al menos un servicio.";
export const TOO_MANY_ITEMS = "Máximo 20 servicios por factura.";
export const MISSING_PRICE = "Escribe el valor de cada servicio.";
const PRICE_RANGE = "El valor va de $ 0 a $ 100.000.000.";
const MISSING_METHOD = "Elige el método de pago.";
const GUEST_NAME = "El nombre lleva de 2 a 80 letras.";

/** Un servicio vendido: su profesional y su valor en pesos enteros (la comisión la pone la base). */
const invoiceItemSchema = z.object({
  serviceId: z.uuid(NO_ITEMS),
  staffId: z.uuid(NO_ITEMS),
  price: z
    .number(MISSING_PRICE)
    .int(PRICE_RANGE)
    .min(0, PRICE_RANGE)
    .max(100_000_000, PRICE_RANGE),
});

/** Crear o editar una factura (T-8.3.2, US-040, US-041 y US-043). */
export const saveInvoiceSchema = z.object({
  invoiceId: z.uuid(MISSING_INVOICE).optional(),
  clientId: z.uuid("Ese cliente ya no existe. Elige otro.").optional(),
  guestName: z
    .string()
    .trim()
    .min(2, GUEST_NAME)
    .max(80, GUEST_NAME)
    .optional(),
  bookingId: z.uuid(BOOKING_GONE).optional(),
  paymentMethodId: z.uuid(MISSING_METHOD),
  items: z
    .array(invoiceItemSchema, NO_ITEMS)
    .min(1, NO_ITEMS)
    .max(20, TOO_MANY_ITEMS),
});
export type SaveInvoiceInput = z.input<typeof saveInvoiceSchema>;

/** La factura rápida desde la cita (T-8.4.1, US-041): solo la cita; lo demás lo pone el servidor. */
export const quickInvoiceSchema = z.object({
  bookingId: z.uuid(BOOKING_GONE),
});
export type QuickInvoiceInput = z.infer<typeof quickInvoiceSchema>;
