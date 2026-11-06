"use client";

import { useAgendaRealtime } from "../hooks/use-agenda-realtime";

interface AgendaRealtimeProps {
  businessId: string;
  staffId: string | null;
  phone: string;
}

// Para poner el tiempo real de la agenda en una página del servidor (la agenda y el inicio, cuyos
// contadores se refrescan con los mismos cambios). No pinta nada.
export function AgendaRealtime(props: AgendaRealtimeProps) {
  useAgendaRealtime(props);
  return null;
}
