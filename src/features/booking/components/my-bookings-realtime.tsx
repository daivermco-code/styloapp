"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Varios cambios seguidos (un reinicio de la demo) piden la página una sola vez.
const REFRESH_DELAY_MS = 150;

/**
 * Tiempo real de las citas del cliente (T-5.4.1): Mis Reservas, el Inicio (la invitación a
 * calificar) y Mi reputación se vuelven a pedir cuando el negocio crea, cambia, cancela o marca
 * la llegada de una de sus citas, y al suscribirse. Sin filtro: Realtime revisa la RLS con cada
 * fila y al cliente solo le llegan las de sus fichas.
 */
export function useMyBookingsRealtime(): void {
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
    // Tema único por montaje: en desarrollo React monta dos veces.
    const topic = `mis-citas:${Math.random().toString(36).slice(2)}`;
    const listen = async () => {
      // Primero el token de la sesión: sin él el canal queda anónimo y la RLS no deja pasar nada.
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bookings" },
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
  }, [router]);
}

// Para poner el tiempo real de las citas del cliente en una página del servidor. No pinta nada.
export function MyBookingsRealtime() {
  useMyBookingsRealtime();
  return null;
}
