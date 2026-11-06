"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loginCodeInbox, markInboxRead } from "../services/actions";
import { INBOX_COLUMNS, toInboxMessage } from "../services/inbox-rows";
import { useInboxStore } from "../store/inbox-store";
import type { InboxMessage } from "../types/inbox";

// Sin sesión no hay Realtime: con la bandeja a la vista se pregunta cada 3 s (US-004: máximo 3 s).
const POLL_MS = 3000;
const MAX_TIMER_MS = 60 * 60 * 1000;
const EMPTY: ReadonlySet<string> = new Set();

interface UseInboxOptions {
  /** Celular de la persona con sesión; null sin sesión. */
  phone: string | null;
  /** La bandeja está a la vista: lo que llega queda leído. */
  active: boolean;
}

export interface Inbox {
  /** Los que ya llegaron, del más nuevo al más viejo. */
  messages: InboxMessage[];
  unreadCount: number;
  /** Estaban sin leer cuando se vieron: llevan el punto de "nuevo" mientras siga abierta. */
  freshIds: ReadonlySet<string>;
  loaded: boolean;
  failed: boolean;
  /** Sin sesión, el celular que está entrando ("+57 300 555 0121"). */
  phoneLabel: string | null;
}

function union(set: ReadonlySet<string>, ids: string[]): ReadonlySet<string> {
  return new Set([...set, ...ids]);
}

function newest(messages: InboxMessage[]): string {
  return messages.reduce(
    (latest, message) =>
      message.deliverAt > latest ? message.deliverAt : latest,
    messages[0].deliverAt,
  );
}

export function useInbox({ phone, active }: UseInboxOptions): Inbox {
  const codeVersion = useInboxStore((state) => state.codeVersion);
  const [rows, setRows] = useState<InboxMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [phoneLabel, setPhoneLabel] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [seen, setSeen] = useState<ReadonlySet<string>>(EMPTY);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(EMPTY);
  const [markBefore, setMarkBefore] = useState<string | null>(null);

  // Con sesión: lee con RLS y escucha Realtime filtrado por su celular. Recarga al suscribirse para
  // no perder lo que llegó mientras se conectaba.
  useEffect(() => {
    if (!phone) return;
    const supabase = createClient();
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("demo_messages")
        .select(INBOX_COLUMNS)
        .order("deliver_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      setFailed(Boolean(error));
      if (data) {
        setRows(data.map(toInboxMessage));
        setNow(Date.now());
        setLoaded(true);
      }
    };
    // Tema único por montaje: en desarrollo React monta dos veces y un canal ya suscrito no
    // acepta escuchas nuevas.
    const topic = `bandeja:${phone}:${Math.random().toString(36).slice(2)}`;
    let channel: RealtimeChannel | null = null;
    const listen = async () => {
      // Primero el token de la sesión: si el canal se une antes de que el cliente lea la cookie,
      // queda con el rol anónimo y RLS no deja pasar ningún cambio.
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "demo_messages",
            filter: `recipient_phone=eq.${phone}`,
          },
          () => void load(),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void load();
        });
    };
    void load();
    void listen();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [phone]);

  // Sin sesión: el código del celular que está entrando, cada vez que se pide uno y, con la bandeja
  // a la vista, cada 3 s.
  useEffect(() => {
    if (phone) return;
    let cancelled = false;
    const load = async () => {
      const result = await loginCodeInbox();
      if (cancelled) return;
      setFailed(!result.ok);
      if (result.ok) {
        setRows(result.data.messages);
        setPhoneLabel(result.data.phoneLabel);
        setNow(Date.now());
        setLoaded(true);
      }
    };
    void load();
    if (!active) {
      return () => {
        cancelled = true;
      };
    }
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [phone, active, codeVersion]);

  // Un recordatorio con hora de entrega futura sale cuando llega esa hora.
  useEffect(() => {
    const next = rows
      .map((row) => Date.parse(row.deliverAt))
      .filter((time) => time > now)
      .sort((a, b) => a - b)[0];
    if (next === undefined) return;
    const delay = Math.min(Math.max(next - Date.now(), 0), MAX_TIMER_MS);
    const timer = window.setTimeout(() => setNow(Date.now()), delay + 50);
    return () => window.clearTimeout(timer);
  }, [rows, now]);

  const messages = useMemo(
    () => rows.filter((row) => Date.parse(row.deliverAt) <= now),
    [rows, now],
  );
  const unread = messages.filter(
    (message) => !message.readAt && !seen.has(message.id),
  );

  // A la vista, lo que llega queda leído; al cerrarla se quitan los puntos de "nuevo".
  if (active && unread.length > 0) {
    const ids = unread.map((message) => message.id);
    setSeen(union(seen, ids));
    setFresh(union(fresh, ids));
    setMarkBefore(newest(unread));
  }
  if (!active && fresh.size > 0) setFresh(EMPTY);

  // Sin sesión no se guarda nada: los códigos quedan leídos solo en este navegador.
  useEffect(() => {
    if (phone && markBefore) void markInboxRead({ before: markBefore });
  }, [phone, markBefore]);

  return {
    messages,
    unreadCount: unread.length,
    freshIds: fresh,
    loaded,
    failed,
    phoneLabel,
  };
}
