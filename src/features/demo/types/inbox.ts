import type { Database } from "@/shared/types/database";

export type InboxChannel = Database["public"]["Enums"]["message_channel"];

/** Un mensaje de la bandeja de la demo (US-004): lo que la app habría enviado. */
export interface InboxMessage {
  id: string;
  channel: InboxChannel;
  kind: string;
  title: string;
  body: string;
  bookingId: string | null;
  deliverAt: string;
  readAt: string | null;
}

/** Sin sesión: los códigos de entrada del celular que está entrando (últimos 10 minutos). */
export interface LoginCodeInbox {
  /** "+57 300 555 0121", o null si nadie está entrando en este navegador. */
  phoneLabel: string | null;
  messages: InboxMessage[];
}
