"use client";

import {
  CalendarSync,
  ChevronRight,
  Clock,
  Lock,
  type LucideIcon,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import {
  type BusinessFunctions,
  cancelLimitLabel,
  maxAdvanceLabel,
  minNoticeLabel,
  slotIntervalLabel,
} from "../lib/functions";

interface MenuEntry {
  label: string;
  hint: string;
  icon: LucideIcon;
  href: string;
}

const ENTRIES: MenuEntry[] = [
  {
    label: "Perfil del negocio",
    hint: "Nombre, dirección, WhatsApp, enlace y QR",
    icon: Store,
    href: "/pro/configurar/negocio",
  },
  {
    label: "Horario del negocio",
    hint: "Los días y las horas en que atiendes",
    icon: Clock,
    href: "/pro/configurar/horario",
  },
  {
    label: "Equipo",
    hint: "Vincula profesionales y ajusta su horario y servicios",
    icon: Users,
    href: "/pro/configurar/equipo",
  },
  {
    label: "Métodos de pago",
    hint: "Efectivo, banco y otros",
    icon: Wallet,
    href: "/pro/configurar/metodos-de-pago",
  },
  {
    label: "Usuarios bloqueados",
    hint: "Clientes que no pueden reservar contigo",
    icon: Lock,
    href: "/pro/configurar/bloqueados",
  },
  {
    label: "Agendas recurrentes",
    hint: "Citas que se repiten para tus clientes frecuentes",
    icon: CalendarSync,
    href: "/pro/configurar/recurrentes",
  },
];

const ENTRY =
  "-mx-3 flex min-h-16 w-[calc(100%+24px)] items-center gap-4 rounded-card px-3 py-3 text-left transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function EntryRow({ label, hint, icon: Icon, href }: MenuEntry) {
  const content = (
    <>
      <Icon className="size-7 shrink-0 text-primary" strokeWidth={1.7} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-18 text-ink">{label}</span>
        <span className="text-14 text-slate">{hint}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-slate" />
    </>
  );
  return (
    <Link href={href} className={ENTRY}>
      {content}
    </Link>
  );
}

// Menú "Configurar negocio" (T-2.2.1, capturas 46 y 65): la lista de ajustes y, debajo, las
// funciones adicionales en filas título–explicación–valor que abren su formulario.
export function SettingsMenu({ functions }: { functions: BusinessFunctions }) {
  const values = [
    {
      label: "Cancelación de citas",
      hint: "Hasta cuánto antes de la cita puede cancelar un cliente",
      value: cancelLimitLabel(functions.cancelLimitMinutes),
    },
    {
      label: "Intervalo de las horas",
      hint: "Cada cuánto salen las horas al reservar: con 30 min se ven 7:30, 8:00, 8:30…",
      value: slotIntervalLabel(functions.slotIntervalMinutes),
    },
    {
      label: "Reservas en línea",
      hint: "Los clientes reservan desde la app y el enlace",
      value: functions.onlineBooking ? "Encendidas" : "Apagadas",
    },
    {
      label: "Agenda del dueño",
      hint: "Los clientes pueden reservar contigo",
      value: functions.showOwnerAgenda ? "Se muestra" : "Oculta",
    },
    {
      label: "Antelación mínima",
      hint: "Con 15 min, nadie reserva para dentro de menos de 15 min",
      value: minNoticeLabel(functions.minNoticeMinutes),
    },
    {
      label: "Anticipación máxima",
      hint: "Hasta cuántos días hacia adelante se puede reservar",
      value: maxAdvanceLabel(functions.maxAdvanceDays),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <ul className="divide-y divide-line">
        {ENTRIES.map((entry) => (
          <li key={entry.label}>
            <EntryRow {...entry} />
          </li>
        ))}
      </ul>

      <section aria-labelledby="funciones" className="flex flex-col">
        <div className="flex items-end justify-between gap-4 border-b border-stroke pb-2">
          <h2 id="funciones" className="text-18 font-bold text-secondary">
            Funciones adicionales
          </h2>
          <Link
            href="/pro/configurar/funciones"
            className="-my-2 flex min-h-11 items-center rounded-card px-2 text-14 font-bold text-primary hover:bg-primary-50"
          >
            Cambiar
          </Link>
        </div>
        <ul className="divide-y divide-line">
          {values.map((row) => (
            <li key={row.label}>
              <Link
                href="/pro/configurar/funciones"
                className="-mx-3 flex min-h-16 items-start gap-4 rounded-card px-3 py-4 transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-16 text-ink">{row.label}</span>
                  <span className="text-14 text-slate">{row.hint}</span>
                </span>
                <span className="shrink-0 pt-0.5 text-16 font-bold text-primary">
                  {row.value}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
