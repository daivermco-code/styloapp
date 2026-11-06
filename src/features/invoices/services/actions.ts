"use server";

import { revalidatePath } from "next/cache";
import { getCurrentPerson } from "@/features/auth/services/queries";
import { firstIssue, SIGN_IN_AGAIN } from "@/features/business/services/owner";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  actionFail,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";
import { invoiceTitle } from "../lib/totals";
import { NO_INVOICING_PERMISSION } from "../types/messages";
import type { InvoiceViewer } from "../types/invoice";
import {
  BOOKING_GONE,
  type QuickInvoiceInput,
  quickInvoiceSchema,
  type SaveInvoiceInput,
  saveInvoiceSchema,
  type VoidInvoiceInput,
  voidInvoiceSchema,
} from "../types/schemas";
import { invoiceError } from "./invoice-errors";
import { getInvoiceViewer } from "./queries";

/**
 * Anula una factura (T-8.2.2, US-043). El permiso se lee de nuevo aquí, y void_invoice revisa
 * todo otra vez: que sea del negocio, que el profesional tenga el permiso y todos los servicios a
 * su nombre, que no esté anulada y que nada de ella haya entrado en un pago al profesional.
 */
export async function voidInvoice(
  input: VoidInvoiceInput,
): Promise<ActionResult<{ invoiceId: string }>> {
  const parsed = voidInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const person = await getCurrentPerson();
  const viewer = person ? await getInvoiceViewer(person) : null;
  if (!viewer) return actionFail(AppErrorCode.UNAUTHORIZED, SIGN_IN_AGAIN);
  if (!viewer.canInvoice) {
    return actionFail(
      AppErrorCode.NO_PERMISSION_INVOICING,
      NO_INVOICING_PERMISSION,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_invoice", {
    p_invoice: parsed.data.invoiceId,
  });
  if (error) return { ok: false, error: invoiceError(error, "voidInvoice") };
  // Cambian la lista, sus totales y el contador del inicio.
  revalidatePath("/pro", "layout");
  return actionOk({ invoiceId: parsed.data.invoiceId });
}

/** Quien llama y si puede facturar; si no, el error para devolver. */
async function invoicingViewer(): Promise<
  | { ok: true; viewer: InvoiceViewer }
  | { ok: false; result: ActionResult<never> }
> {
  const person = await getCurrentPerson();
  const viewer = person ? await getInvoiceViewer(person) : null;
  if (!viewer) {
    return {
      ok: false,
      result: actionFail(AppErrorCode.UNAUTHORIZED, SIGN_IN_AGAIN),
    };
  }
  if (!viewer.canInvoice) {
    return {
      ok: false,
      result: actionFail(
        AppErrorCode.NO_PERMISSION_INVOICING,
        NO_INVOICING_PERMISSION,
      ),
    };
  }
  return { ok: true, viewer };
}

/**
 * Crea o edita una factura (T-8.3.2, US-040, US-041 y US-043) con save_invoice, que revisa todo
 * otra vez en una sola transacción: el permiso, que el profesional solo ponga servicios a su
 * nombre, la cita, el método activo, de 1 a 20 servicios y, al editar, que no esté anulada ni
 * pagada al profesional. La comisión no viaja desde el navegador: la copia la base.
 */
export async function saveInvoice(
  input: SaveInvoiceInput,
): Promise<ActionResult<{ invoiceId: string; number: number }>> {
  const parsed = saveInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const caller = await invoicingViewer();
  if (!caller.ok) return caller.result;

  const data = parsed.data;
  const supabase = await createClient();
  const { data: invoiceId, error } = await supabase.rpc("save_invoice", {
    p_business: caller.viewer.businessId,
    p_method: data.paymentMethodId,
    p_items: data.items.map((item) => ({
      service_id: item.serviceId,
      staff_id: item.staffId,
      price: item.price,
    })),
    p_invoice: data.invoiceId,
    p_client: data.clientId,
    p_guest_name: data.clientId ? undefined : data.guestName,
    p_booking: data.bookingId,
  });
  if (error) return { ok: false, error: invoiceError(error, "saveInvoice") };

  const { data: row } = await supabase
    .from("invoices")
    .select("number")
    .eq("id", invoiceId)
    .maybeSingle();
  // Cambian la lista, sus totales, el contador del inicio y la cita facturada.
  revalidatePath("/pro", "layout");
  return actionOk({ invoiceId, number: row?.number ?? 0 });
}

/** El primer método activo del negocio, en su orden (siempre hay uno: payment_methods_guard). */
async function firstActiveMethod(businessId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_methods")
    .select("id, name")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("position")
    .order("name")
    .limit(1)
    .maybeSingle();
  return data;
}

/**
 * Factura rápida desde la cita (T-8.4.1, US-041): la crea de una vez con el servicio, el
 * profesional, el precio y el cliente de la cita, y con el primer método activo. No recibe precio
 * ni método del navegador (Blueprint, notas de la Fase 8). save_invoice revisa otra vez el
 * permiso, que la cita sea del profesional, la llegada marcada y que no tenga otra factura pagada.
 */
export async function quickInvoice(
  input: QuickInvoiceInput,
): Promise<ActionResult<{ invoiceId: string; message: string }>> {
  const parsed = quickInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const caller = await invoicingViewer();
  if (!caller.ok) return caller.result;
  const { businessId } = caller.viewer;

  const supabase = await createClient();
  const [{ data: booking }, method] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, service_id, staff_id, price, client_id, guest_name, status")
      .eq("id", parsed.data.bookingId)
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .maybeSingle(),
    firstActiveMethod(businessId),
  ]);
  if (!booking) return actionFail(AppErrorCode.NOT_FOUND, BOOKING_GONE);
  if (!method) {
    return actionFail(
      AppErrorCode.METHOD_INACTIVE,
      "Activa un método de pago para facturar.",
    );
  }

  const { data: invoiceId, error } = await supabase.rpc("save_invoice", {
    p_business: businessId,
    p_method: method.id,
    p_items: [
      {
        service_id: booking.service_id,
        staff_id: booking.staff_id,
        price: booking.price,
      },
    ],
    p_client: booking.client_id ?? undefined,
    p_guest_name: booking.client_id
      ? undefined
      : (booking.guest_name ?? undefined),
    p_booking: booking.id,
  });
  if (error) return { ok: false, error: invoiceError(error, "quickInvoice") };

  const { data: row } = await supabase
    .from("invoices")
    .select("number")
    .eq("id", invoiceId)
    .maybeSingle();
  // Cambian la cita (ya facturada), Facturas, sus totales y el contador del inicio.
  revalidatePath("/pro", "layout");
  return actionOk({
    invoiceId,
    message: `${invoiceTitle(row?.number ?? 0)} creada en ${method.name}.`,
  });
}
