import "server-only";
import { getBookingCatalog } from "@/features/agenda/services/queries";
import type { BookingCategoryOption } from "@/features/agenda/types/agenda";
import { getPaymentMethods } from "@/features/business/services/queries";
import { createClient } from "@/lib/supabase/server";
import {
  commissionKey,
  DEFAULT_COMMISSION,
  editBlockReason,
} from "../lib/draft";
import type {
  InvoiceMethodOption,
  InvoiceSeed,
  InvoiceViewer,
} from "../types/invoice";
import {
  ALREADY_INVOICED,
  INVOICE_GONE,
  MARK_BEFORE_INVOICING,
} from "../types/messages";
import { invoiceAllMine } from "./queries";

// Lo que lee el editor de factura (T-8.3.1 y T-8.3.2, US-040, US-041 y US-043): el catálogo con
// el precio de cada profesional, la comisión (solo el dueño), los métodos y lo que trae la cita o
// la factura. La base lo vuelve a revisar todo en save_invoice.

/** Lo que pasa al abrir el editor con ?cita= o en /editar: el borrador, o por qué no se puede. */
export type SeedResult =
  | { ok: true; seed: InvoiceSeed }
  | { ok: false; message: string; invoiceId?: string };

/**
 * El catálogo del editor: el mismo de la reserva (servicios activos por categoría, con el precio
 * de cada profesional). El profesional solo se ve a sí mismo: no puede poner servicios de otro.
 */
export function getInvoiceCatalog(
  viewer: InvoiceViewer,
): Promise<BookingCategoryOption[]> {
  return getBookingCatalog(viewer);
}

/**
 * La comisión de cada profesional del catálogo por servicio, para el resumen del paso 3. Solo el
 * dueño la lee (staff_commissions; la columna está oculta para el equipo): al profesional le
 * llega null y el paso 3 muestra solo el total. Sin comisión propia, 50 % como en la base.
 */
export async function getInvoiceCommissions(
  viewer: InvoiceViewer,
  categories: BookingCategoryOption[],
): Promise<Record<string, number> | null> {
  if (viewer.side !== "owner") return null;
  const staffIds = [
    ...new Set(
      categories.flatMap((category) =>
        category.services.flatMap((service) => service.staff.map((s) => s.id)),
      ),
    ),
  ];
  const supabase = await createClient();
  const rows = await Promise.all(
    staffIds.map(async (staffId) => {
      const { data } = await supabase.rpc("staff_commissions", {
        p_staff: staffId,
      });
      return (data ?? []).map((row) => ({ staffId, ...row }));
    }),
  );
  const commissions: Record<string, number> = {};
  for (const row of rows.flat()) {
    commissions[commissionKey(row.staffId, row.service_id)] =
      row.commission_pct === null
        ? DEFAULT_COMMISSION
        : Number(row.commission_pct);
  }
  return commissions;
}

/** Los métodos activos en su orden y, al editar, el que ya tenía la factura aunque esté apagado. */
export async function getInvoiceMethods(
  businessId: string,
  keepId: string | null,
): Promise<InvoiceMethodOption[]> {
  const methods = await getPaymentMethods(businessId);
  return methods
    .filter((method) => method.isActive || method.id === keepId)
    .map((method) => ({ id: method.id, name: method.name }));
}

async function fetchBooking(viewer: InvoiceViewer, bookingId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, staff_id, service_id, client_id, guest_name, price, starts_at, status, punctuality, clients(full_name), services(name), staff(display_name)",
    )
    .eq("id", bookingId)
    .eq("business_id", viewer.businessId)
    .maybeSingle();
  return data;
}

/**
 * La factura pagada de la cita: su id si quien mira la ve. Si no la ve (el dueño la facturó solo
 * con servicios de otro profesional), booking_is_invoiced dice que existe, sin el id.
 */
async function paidInvoiceOf(
  bookingId: string,
): Promise<{ id: string | null } | null> {
  const supabase = await createClient();
  const [{ data }, { data: invoiced }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("status", "paid")
      .maybeSingle(),
    supabase.rpc("booking_is_invoiced", { p_booking: bookingId }),
  ]);
  if (data) return { id: data.id };
  return invoiced === true ? { id: null } : null;
}

/**
 * Facturar desde la cita (US-041): el cliente (o el nombre libre), el servicio, el profesional y
 * el precio de la cita, para entrar al paso 3. Sin la llegada marcada o ya facturada, el aviso.
 */
export async function getBookingSeed(
  viewer: InvoiceViewer,
  bookingId: string,
): Promise<SeedResult> {
  const booking = await fetchBooking(viewer, bookingId);
  if (!booking || booking.status === "cancelled") {
    return { ok: false, message: "Esta cita ya no existe." };
  }
  if (booking.punctuality !== 3 && booking.punctuality !== 5) {
    return {
      ok: false,
      message: MARK_BEFORE_INVOICING,
    };
  }
  const invoiced = await paidInvoiceOf(booking.id);
  if (invoiced) {
    return {
      ok: false,
      message: ALREADY_INVOICED,
      invoiceId: invoiced.id ?? undefined,
    };
  }
  return {
    ok: true,
    seed: {
      invoiceId: null,
      bookingId: booking.id,
      bookingStartsAt: booking.starts_at,
      client: booking.client_id
        ? {
            kind: "client",
            id: booking.client_id,
            fullName: booking.clients?.full_name ?? "",
          }
        : { kind: "guest" },
      guestName: booking.guest_name ?? "",
      items: [
        {
          serviceId: booking.service_id,
          serviceName: booking.services?.name ?? "",
          staffId: booking.staff_id,
          staffName: booking.staff?.display_name ?? "",
          price: booking.price,
        },
      ],
      methodId: null,
    },
  };
}

async function fetchInvoice(viewer: InvoiceViewer, invoiceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select(
      "id, status, client_id, guest_name, booking_id, payment_method_id, clients(full_name), bookings(starts_at), invoice_items(service_id, staff_id, price, position, staff_payment_id, services(name), staff(display_name))",
    )
    .eq("id", invoiceId)
    .eq("business_id", viewer.businessId)
    .order("position", { referencedTable: "invoice_items" })
    .maybeSingle();
  return data;
}

/**
 * Editar una factura (US-043): la carga en el borrador, o dice por qué no se puede (anulada, ya
 * pagada al profesional o, para el profesional, con servicios de otro).
 */
export async function getInvoiceSeed(
  viewer: InvoiceViewer,
  invoiceId: string,
): Promise<SeedResult> {
  const [invoice, allMine] = await Promise.all([
    fetchInvoice(viewer, invoiceId),
    viewer.side === "owner" ? true : invoiceAllMine(invoiceId),
  ]);
  if (!invoice) return { ok: false, message: INVOICE_GONE };
  const items = invoice.invoice_items;
  const blocked = editBlockReason(viewer, {
    status: invoice.status,
    paidOut: items.some((item) => item.staff_payment_id !== null),
    allMine,
  });
  if (blocked) return { ok: false, message: blocked, invoiceId };
  return {
    ok: true,
    seed: {
      invoiceId: invoice.id,
      bookingId: invoice.booking_id,
      bookingStartsAt: invoice.bookings?.starts_at ?? null,
      client: invoice.client_id
        ? {
            kind: "client",
            id: invoice.client_id,
            fullName: invoice.clients?.full_name ?? "",
          }
        : { kind: "guest" },
      guestName: invoice.guest_name ?? "",
      items: items.map((item) => ({
        serviceId: item.service_id,
        serviceName: item.services?.name ?? "",
        staffId: item.staff_id,
        staffName: item.staff?.display_name ?? "",
        price: item.price,
      })),
      methodId: invoice.payment_method_id,
    },
  };
}
