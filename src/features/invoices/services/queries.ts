import "server-only";
import type { CurrentPerson } from "@/features/auth/services/queries";
import { getMyStaff, getTeam } from "@/features/team/services/queries";
import { createClient } from "@/lib/supabase/server";
import type { PeriodRange } from "@/shared/lib/periods";
import { canChangeInvoice, invoicePayouts } from "../lib/detail";
import { summarizeLines } from "../lib/totals";
import type {
  InvoiceDetail,
  InvoiceDetailLine,
  InvoiceListItem,
  InvoiceStaffOption,
  InvoiceViewer,
} from "../types/invoice";
import { NO_CLIENT } from "../types/messages";

/**
 * Quién mira Facturas y si puede facturar (T-8.2.1, US-042). El permiso del profesional se lee en
 * cada visita, como en la agenda: si el dueño lo apaga, el + avisa al instante. La base lo vuelve
 * a revisar en save_invoice. Null si la persona no está en un negocio.
 */
export async function getInvoiceViewer(
  person: CurrentPerson,
): Promise<InvoiceViewer | null> {
  const staff = await getMyStaff(person.id);
  if (!staff) return null;
  const base = { businessId: staff.businessId, staffId: staff.id };
  if (staff.role === "owner") {
    return { ...base, side: "owner", canInvoice: true };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_permissions")
    .select("invoicing")
    .eq("business_id", staff.businessId)
    .maybeSingle();
  // Sin fila, la base tampoco lo deja (team_can devuelve null y save_invoice lo toma como no).
  return { ...base, side: "staff", canInvoice: data?.invoicing ?? false };
}

/** La fila de profesionales del dueño: el equipo activo, el dueño primero (getTeam). */
export async function getInvoiceStaffOptions(
  businessId: string,
): Promise<InvoiceStaffOption[]> {
  const team = await getTeam(businessId);
  return team
    .filter((member) => member.isActive)
    .map((member) => ({ id: member.id, name: member.displayName }));
}

/**
 * Las facturas de un periodo, pagadas y anuladas, con su valor y su comisión dentro de lo que se
 * mira. `staffId` deja solo las que tienen servicios de ese profesional y cuenta solo esos
 * servicios: es el que eligió el dueño, o el propio profesional. Al profesional la RLS ya le
 * entrega solo sus ítems y las facturas donde los tiene (Blueprint, notas de la Fase 8).
 */
export async function getInvoiceList(
  viewer: InvoiceViewer,
  range: PeriodRange,
  staffId: string | null,
): Promise<InvoiceListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select(
      "id, number, status, issued_on, guest_name, clients(full_name), payment_methods(name), invoice_items!inner(staff_id, price, commission, position, services(name))",
    )
    .eq("business_id", viewer.businessId)
    .gte("issued_on", range.from)
    .lte("issued_on", range.to)
    .order("position", { referencedTable: "invoice_items" });
  if (staffId) query = query.eq("invoice_items.staff_id", staffId);
  const { data } = await query;

  return (data ?? []).map((row) => {
    const summary = summarizeLines(
      row.invoice_items.map((item) => ({
        staffId: item.staff_id,
        serviceName: item.services?.name ?? "",
        price: item.price,
        commission: item.commission ?? 0,
      })),
      staffId,
    );
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      issuedOn: row.issued_on,
      clientName: row.clients?.full_name ?? row.guest_name ?? NO_CLIENT,
      methodName: row.payment_methods?.name ?? "",
      services: summary.services,
      value: summary.value,
      commission: summary.commission,
    };
  });
}

const DETAIL_COLUMNS =
  "id, number, status, issued_on, client_id, guest_name, booking_id, created_by, voided_by, voided_at, clients(full_name), payment_methods(name), bookings(id, starts_at), invoice_items(id, staff_id, price, commission_pct, commission, position, staff_payment_id, services(name), staff(display_name), staff_payments(paid_on, staff(display_name)))";

async function fetchInvoiceRow(businessId: string, invoiceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select(DETAIL_COLUMNS)
    .eq("id", invoiceId)
    .eq("business_id", businessId)
    .order("position", { referencedTable: "invoice_items" })
    .maybeSingle();
  return data;
}

type InvoiceRow = NonNullable<Awaited<ReturnType<typeof fetchInvoiceRow>>>;

/**
 * El nombre en el equipo de quien hizo y de quien anuló la factura. created_by y voided_by son
 * perfiles, y cada quien solo lee el suyo: el nombre sale de staff, que el equipo sí lee.
 */
async function staffNamesByProfile(
  businessId: string,
  profileIds: (string | null)[],
): Promise<Map<string, string>> {
  const ids = profileIds.filter((id): id is string => id !== null);
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("profile_id, display_name")
    .eq("business_id", businessId)
    .in("profile_id", ids);
  return new Map((data ?? []).map((row) => [row.profile_id, row.display_name]));
}

function detailLines(row: InvoiceRow): InvoiceDetailLine[] {
  return row.invoice_items.map((item) => ({
    id: item.id,
    serviceName: item.services?.name ?? "",
    staffId: item.staff_id,
    staffName: item.staff?.display_name ?? "",
    price: item.price,
    commissionPct: Number(item.commission_pct),
    commission: item.commission ?? 0,
  }));
}

function detailPayouts(row: InvoiceRow) {
  return invoicePayouts(
    row.invoice_items.map((item) => ({
      staffPaymentId: item.staff_payment_id,
      staffName: item.staff?.display_name ?? "",
      payment: item.staff_payments
        ? {
            paidOn: item.staff_payments.paid_on,
            staffName: item.staff_payments.staff?.display_name ?? "",
          }
        : null,
    })),
  );
}

/**
 * Si todos los servicios de la factura son de quien mira (revisión de las Fases 8 a 14, punto 3).
 * Lo dice la base: al profesional la RLS le esconde los de otros, y uno ajeno de $ 0 no cambia
 * la suma. Si falla, no: la base lo vuelve a revisar al guardar o anular.
 */
export async function invoiceAllMine(invoiceId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("invoice_all_mine", {
    p_invoice: invoiceId,
  });
  return data === true;
}

/**
 * Una factura del negocio con sus servicios (T-8.2.2, US-043), o null si no existe o quien mira
 * no la puede ver. Al profesional la RLS le entrega solo sus servicios, y solo si tiene alguno;
 * el pago al profesional (staff_payments) solo lo lee el dueño.
 */
export async function getInvoiceDetail(
  viewer: InvoiceViewer,
  invoiceId: string,
): Promise<InvoiceDetail | null> {
  // Al dueño no le hace falta preguntar: Editar y Anular no dependen de quién hizo los servicios.
  const [row, allMine] = await Promise.all([
    fetchInvoiceRow(viewer.businessId, invoiceId),
    viewer.side === "owner" ? true : invoiceAllMine(invoiceId),
  ]);
  if (!row) return null;
  const names = await staffNamesByProfile(viewer.businessId, [
    row.created_by,
    row.voided_by,
  ]);
  const lines = detailLines(row);
  const payouts = detailPayouts(row);
  const total = lines.reduce((sum, line) => sum + line.price, 0);
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    issuedOn: row.issued_on,
    clientId: row.client_id,
    clientName: row.clients?.full_name ?? row.guest_name ?? NO_CLIENT,
    booking: row.bookings
      ? { id: row.bookings.id, startsAt: row.bookings.starts_at }
      : null,
    methodName: row.payment_methods?.name ?? "",
    createdByName: row.created_by ? (names.get(row.created_by) ?? null) : null,
    voidedByName: row.voided_by ? (names.get(row.voided_by) ?? null) : null,
    voidedAt: row.voided_at,
    lines,
    total,
    payouts,
    canChange: canChangeInvoice(viewer, {
      status: row.status,
      paidOut: payouts.length > 0,
      allMine,
    }),
  };
}
