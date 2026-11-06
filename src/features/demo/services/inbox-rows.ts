import type { Database } from "@/shared/types/database";
import type { InboxMessage } from "../types/inbox";

type MessageRow = Pick<
  Database["public"]["Tables"]["demo_messages"]["Row"],
  | "id"
  | "channel"
  | "kind"
  | "title"
  | "body"
  | "booking_id"
  | "deliver_at"
  | "read_at"
>;

// Las mismas columnas en el navegador (con sesión) y en el servidor (código sin sesión).
export const INBOX_COLUMNS =
  "id, channel, kind, title, body, booking_id, deliver_at, read_at";

export function toInboxMessage(row: MessageRow): InboxMessage {
  return {
    id: row.id,
    channel: row.channel,
    kind: row.kind,
    title: row.title,
    body: row.body,
    bookingId: row.booking_id,
    deliverAt: row.deliver_at,
    readAt: row.read_at,
  };
}
