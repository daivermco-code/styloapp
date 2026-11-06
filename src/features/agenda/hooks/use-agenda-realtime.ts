"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Varios cambios seguidos (una serie, un reinicio) piden el día una sola vez.
const REFRESH_DELAY_MS = 150;

interface AgendaRealtimeOptions {
  businessId: string;
  /** El profesional escucha solo su columna; el dueño (null), todo el negocio. */
  staffId: string | null;
  /** Celular de la persona: sus avisos de la bandeja también recargan. */
  phone: string;
}

/**
 * Tiempo real de la agenda y del inicio (T-3.3.3): con cada cambio en `bookings` o en `staff`, y
 * con cada reseña nueva, vuelve a pedir la página al servidor. También al suscribirse y al
 * reconectar, para no perder lo que cambió mientras se conectaba.
 *
 * Realtime revisa la RLS con la fila nueva: si el dueño pasa una cita de Camilo a Julián, a
 * Camilo no le llega el cambio. Sí le llega el aviso "pasó a Julián" a su bandeja, así que sus
 * mensajes también recargan.
 */
export function useAgendaRealtime({
  businessId,
  staffId,
  phone,
}: AgendaRealtimeOptions): void {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let timer: number | undefined;
    let channel: RealtimeChannel | null = null;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => router.refresh(), REFRESH_DELAY_MS);
    };
    // Tema único por montaje: en desarrollo React monta dos veces y un canal ya suscrito no
    // acepta escuchas nuevas.
    const topic = `agenda:${businessId}:${Math.random().toString(36).slice(2)}`;
    const listen = async () => {
      // Primero el token de la sesión: sin él el canal queda anónimo y la RLS no deja pasar nada.
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bookings",
            filter: staffId
              ? `staff_id=eq.${staffId}`
              : `business_id=eq.${businessId}`,
          },
          refresh,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "staff",
            filter: `business_id=eq.${businessId}`,
          },
          refresh,
        )
        // Una reseña nueva cambia la calificación del inicio (US-006, Fase 5).
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "reviews",
            filter: staffId
              ? `staff_id=eq.${staffId}`
              : `business_id=eq.${businessId}`,
          },
          refresh,
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "demo_messages",
            filter: `recipient_phone=eq.${phone}`,
          },
          refresh,
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") refresh();
        });
    };
    void listen();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [businessId, staffId, phone, router]);
}
