import "server-only";
import { NO_CLIENT } from "@/features/agenda/services/queries";
import { createClient } from "@/lib/supabase/server";
import type {
  PayrollDetail,
  PayrollRow,
  PaymentDetail,
  PaymentListItem,
  PendingItem,
  UnmarkedBooking,
} from "../types/payroll";

// Liquidador e historial de pagos (US-045 y US-046). Todo es del dueño: payroll() le devuelve 0
// filas a otro, y la RLS solo le deja leer los ítems, las citas y los pagos de su negocio.

const ITEM_COLUMNS =
  "id, price, commission, invoice_id, invoices!inner(number, issued_on, status), services(name)";

interface ItemRow {
  id: string;
  price: number;
  /** Columna calculada: los tipos de la base la dan como posible null. */
  commission: number | null;
  invoice_id: string;
  invoices: { number: number; issued_on: string; status: string };
  services: { name: string } | null;
}

function toItem(row: ItemRow): PendingItem {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoices.number,
    issuedOn: row.invoices.issued_on,
    serviceName: row.services?.name ?? "Servicio",
    price: row.price,
    commission: row.commission ?? 0,
  };
}

/** Del más viejo al más nuevo: por día, número de factura y orden del servicio. */
function byInvoice(a: PendingItem, b: PendingItem): number {
  return (
    a.issuedOn.localeCompare(b.issuedOn) || a.invoiceNumber - b.invoiceNumber
  );
}

/** Los servicios pendientes de un profesional: facturas pagadas, sin pago. */
async function pendingItems(
  businessId: string,
  staffId: string,
): Promise<PendingItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice_items")
    .select(ITEM_COLUMNS)
    .eq("business_id", businessId)
    .is("staff_payment_id", null)
    .eq("invoices.status", "paid")
    .eq("staff_id", staffId)
    .order("position");
  if (error) {
    console.error("[pendingItems]", error.code);
    throw new Error("No se pudo cargar el liquidador.");
  }
  return (data ?? []).map(toItem).sort(byInvoice);
}

interface PayrollTotals {
  staffId: string;
  name: string;
  isActive: boolean;
  pending: number;
  items: number;
  invoices: number;
  unmarked: number;
}

/** Lo que suma payroll() en la base: la misma cuenta que paga pay_staff. */
async function payrollTotals(businessId: string): Promise<PayrollTotals[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("payroll", {
    p_business: businessId,
  });
  if (error) {
    console.error("[payrollTotals]", error.code);
    throw new Error("No se pudo cargar el liquidador.");
  }
  return (data ?? []).map((row) => ({
    staffId: row.staff_id,
    name: row.display_name,
    isActive: row.is_active,
    pending: Number(row.pending),
    items: Number(row.items),
    invoices: Number(row.invoices),
    unmarked: Number(row.unmarked),
  }));
}

/** El día de la factura pagada más vieja con algo pendiente para el profesional, o null. */
async function oldestPending(
  businessId: string,
  staffId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("issued_on, invoice_items!inner(id)")
    .eq("business_id", businessId)
    .eq("status", "paid")
    .eq("invoice_items.staff_id", staffId)
    .is("invoice_items.staff_payment_id", null)
    .order("issued_on")
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[oldestPending]", error.code);
    throw new Error("No se pudo cargar el liquidador.");
  }
  return data?.issued_on ?? null;
}

/** Una tarjeta por profesional (sin el dueño): lo pendiente, de dónde sale y las citas sin marcar. */
export async function getPayroll(businessId: string): Promise<PayrollRow[]> {
  const rows = await payrollTotals(businessId);
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      since:
        row.pending > 0 ? await oldestPending(businessId, row.staffId) : null,
    })),
  );
}

/** Las citas del profesional que ya empezaron sin la llegada marcada (lo que pide pay_staff). */
async function unmarkedBookings(staffId: string): Promise<UnmarkedBooking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, starts_at, guest_name, clients(full_name), services(name)")
    .eq("staff_id", staffId)
    .eq("status", "pending")
    .lte("starts_at", new Date().toISOString())
    .order("starts_at");
  if (error) {
    console.error("[unmarkedBookings]", error.code);
    throw new Error("No se pudo cargar el liquidador.");
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    clientName: row.clients?.full_name ?? row.guest_name ?? NO_CLIENT,
    serviceName: row.services?.name ?? "Servicio",
  }));
}

/** El detalle de un profesional del negocio (no el dueño), o null si no es del equipo. */
export async function getPayrollDetail(
  businessId: string,
  staffId: string,
): Promise<PayrollDetail | null> {
  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("staff")
    .select("id, display_name")
    .eq("business_id", businessId)
    .eq("id", staffId)
    .eq("role", "staff")
    .maybeSingle();
  if (!staff) return null;
  const [unmarked, items, totals] = await Promise.all([
    unmarkedBookings(staffId),
    pendingItems(businessId, staffId),
    payrollTotals(businessId),
  ]);
  return {
    staffId: staff.id,
    name: staff.display_name,
    unmarked,
    items,
    // El total es el de la base (lo que pagará pay_staff), no la suma de las filas que llegaron.
    total: totals.find((row) => row.staffId === staffId)?.pending ?? 0,
  };
}

const PAYMENT_COLUMNS =
  "id, amount, paid_on, note, created_at, staff(display_name), payment_methods(name)";

/** Los pagos al equipo, del más reciente al más viejo. */
export async function getPayments(
  businessId: string,
): Promise<PaymentListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_payments")
    .select(PAYMENT_COLUMNS)
    .eq("business_id", businessId)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[getPayments]", error.code);
    throw new Error("No se pudo cargar el historial de pagos.");
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    staffName: row.staff?.display_name ?? "Profesional",
    amount: row.amount,
    paidOn: row.paid_on,
    methodName: row.payment_methods?.name ?? "",
  }));
}

/** Un pago del negocio con los servicios que cubrió, o null si no existe o es de otro. */
export async function getPayment(
  businessId: string,
  paymentId: string,
): Promise<PaymentDetail | null> {
  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("staff_payments")
    .select(PAYMENT_COLUMNS)
    .eq("business_id", businessId)
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return null;
  const { data, error } = await supabase
    .from("invoice_items")
    .select(ITEM_COLUMNS)
    .eq("business_id", businessId)
    .eq("staff_payment_id", paymentId)
    .order("position");
  if (error) {
    console.error("[getPayment]", error.code);
    throw new Error("No se pudo cargar el pago.");
  }
  return {
    id: payment.id,
    staffName: payment.staff?.display_name ?? "Profesional",
    amount: payment.amount,
    paidOn: payment.paid_on,
    methodName: payment.payment_methods?.name ?? "",
    note: payment.note,
    items: (data ?? []).map(toItem).sort(byInvoice),
  };
}
