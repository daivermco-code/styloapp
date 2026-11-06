import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  BusinessInsights,
  CommissionReportRow,
  Follower,
  MethodReportRow,
  ReportRange,
  ReportSummary,
  ServiceReportRow,
} from "../types/report";

// Informes (Tech Spec O5.3 y O5.4). Las funciones report_* leen con los permisos de quien llama
// (invariante 12): al profesional la base le entrega solo lo suyo aunque se le pase otro. Los
// filtros ya llegan revisados por Zod, así que un error aquí es de la base o de la red.

const LOAD_ERROR = "No se pudieron cargar los informes.";

export interface ReportArgs {
  businessId: string;
  range: ReportRange;
  /** El profesional elegido por el dueño; null es "Todos". */
  staffId: string | null;
}

function rpcArgs({ businessId, range, staffId }: ReportArgs) {
  return {
    p_business: businessId,
    p_from: range.from,
    p_to: range.to,
    ...(staffId ? { p_staff: staffId } : {}),
  };
}

function fail(where: string, code: string | undefined): never {
  console.error(`[${where}]`, code);
  throw new Error(LOAD_ERROR);
}

/** Los Indicadores generales de un rango. Gastos llega null si no son del que mira. */
export async function getReportSummary(
  args: ReportArgs,
): Promise<ReportSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_summary", rpcArgs(args));
  if (error) fail("getReportSummary", error.code);
  const row = data?.[0];
  // Los tipos generados no saben que Gastos puede venir null.
  const expenses = row?.expenses as number | null | undefined;
  return {
    services: Number(row?.services ?? 0),
    products: Number(row?.products ?? 0),
    expenses: expenses == null ? null : Number(expenses),
    commissions: Number(row?.commissions ?? 0),
    invoices: Number(row?.invoices ?? 0),
  };
}

/** Lo de ahora y lo de antes, en paralelo (Blueprint, notas de la Fase 13). */
export async function getSummaryPair(
  args: ReportArgs,
  previous: ReportRange,
): Promise<{ current: ReportSummary; previous: ReportSummary }> {
  const [current, before] = await Promise.all([
    getReportSummary(args),
    getReportSummary({ ...args, range: previous }),
  ]);
  return { current, previous: before };
}

/** Ventas: por servicio, de mayor a menor. */
export async function getServicesReport(
  args: ReportArgs,
): Promise<ServiceReportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_services", rpcArgs(args));
  if (error) fail("getServicesReport", error.code);
  return (data ?? []).map((row) => ({
    serviceId: row.service_id,
    name: row.name,
    times: Number(row.times),
    total: Number(row.total),
  }));
}

/** Comisiones: por profesional, lo vendido, lo ganado, lo pagado y lo que falta. */
export async function getCommissionsReport(
  args: ReportArgs,
): Promise<CommissionReportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "report_commissions",
    rpcArgs(args),
  );
  if (error) fail("getCommissionsReport", error.code);
  return (data ?? []).map((row) => ({
    staffId: row.staff_id,
    name: row.name,
    sold: Number(row.sold),
    earned: Number(row.earned),
    paid: Number(row.paid),
    pending: Number(row.pending),
  }));
}

/** Métodos de pago: solo el dueño (la base le da FORBIDDEN al profesional). */
export async function getMethodsReport(
  args: Omit<ReportArgs, "staffId">,
): Promise<MethodReportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_methods", {
    p_business: args.businessId,
    p_from: args.range.from,
    p_to: args.range.to,
  });
  if (error) fail("getMethodsReport", error.code);
  return (data ?? []).map((row) => ({
    methodId: row.method_id,
    name: row.name,
    isActive: row.is_active,
    total: Number(row.total),
    invoices: Number(row.invoices),
  }));
}

const STATS_ERROR = "No se pudieron cargar las estadísticas.";

/** Estadísticas: seguidores, reservas de usuarios y visitas (solo el equipo del negocio). */
export async function getBusinessInsights(
  businessId: string,
): Promise<BusinessInsights> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("business_insights", {
    p_business: businessId,
  });
  if (error) {
    console.error("[getBusinessInsights]", error.code);
    throw new Error(STATS_ERROR);
  }
  const row = data?.[0];
  return {
    followers: Number(row?.followers ?? 0),
    clientBookings: Number(row?.client_bookings ?? 0),
    visits: Number(row?.visits ?? 0),
  };
}

/** La lista de seguidores, del más reciente al más antiguo. */
export async function getBusinessFollowers(
  businessId: string,
): Promise<Follower[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("business_followers", {
    p_business: businessId,
  });
  if (error) {
    console.error("[getBusinessFollowers]", error.code);
    throw new Error(STATS_ERROR);
  }
  return (data ?? []).map((row) => ({
    fullName: row.full_name,
    followedAt: row.followed_at,
  }));
}
