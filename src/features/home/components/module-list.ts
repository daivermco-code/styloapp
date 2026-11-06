import {
  Boxes,
  CalendarDays,
  Contact,
  ChartColumn,
  ClipboardList,
  FileClock,
  Gift,
  GraduationCap,
  HandCoins,
  ImageUp,
  type LucideIcon,
  Megaphone,
  ReceiptText,
  Tag,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

export interface HomeModule {
  label: string;
  icon: LucideIcon;
  /** Ruta del módulo. Sin ella, avisa que llega en una próxima etapa de la demo. */
  href?: string;
}

export interface ModuleSection {
  /** Sin título, como en el inicio del profesional. */
  title: string | null;
  modules: HomeModule[];
}

export const SOON_MESSAGE = "Esto llega en una próxima etapa de la demo.";

const AGENDA: HomeModule = {
  label: "Agenda",
  icon: CalendarDays,
  href: "/pro/agenda",
};
// Informes (T-13.1.2, US-052 y US-057): el dueño ve los del negocio y el profesional, los suyos.
const REPORTS: HomeModule = {
  label: "Informes",
  icon: ChartColumn,
  href: "/pro/informes",
};
// Facturas (T-8.2.1, US-042): el dueño ve las del negocio y el profesional, las suyas.
const INVOICES: HomeModule = {
  label: "Facturas",
  icon: ReceiptText,
  href: "/pro/facturas",
};
// Gastos (T-9.1.1, US-044): solo el dueño.
const EXPENSES: HomeModule = {
  label: "Gastos",
  icon: HandCoins,
  href: "/pro/gastos",
};
// Clientes (T-10.1.2, US-047): solo el dueño.
const CLIENTS: HomeModule = {
  label: "Clientes",
  icon: Users,
  href: "/pro/clientes",
};
// Liquidador (T-9.2.1, US-045, módulo nuevo, después de Historial de pagos como pide la pantalla
// A.2) e Historial de pagos (T-9.3.1, US-046): solo el dueño.
const PAYROLL: HomeModule = {
  label: "Liquidador",
  icon: Wallet,
  href: "/pro/liquidador",
};
const PAYMENTS: HomeModule = {
  label: "Historial de pagos",
  icon: FileClock,
  href: "/pro/pagos",
};
// Estadísticas (T-14.1.2, US-058): el dueño entra desde Marketing y ventas; los dos, también desde
// el contador de seguidores del inicio.
const STATS: HomeModule = {
  label: "Estadísticas",
  icon: TrendingUp,
  href: "/pro/estadisticas",
};
const SAMPLES: HomeModule = { label: "Muestras de trabajo", icon: ImageUp };
const COURSES: HomeModule = { label: "Cursos", icon: GraduationCap };

const SERVICES: HomeModule = {
  label: "Servicios",
  icon: ClipboardList,
  href: "/pro/servicios",
};
const TEAM: HomeModule = {
  label: "Equipo",
  icon: Contact,
  href: "/pro/configurar/equipo",
};

// Módulos del dueño (US-006, flujos.md §2 y capturas 21–22). El menú lateral del computador
// también lleva a Equipo, como el inicio en computador del Blueprint.
function ownerSections(menu: boolean): ModuleSection[] {
  return [
    {
      title: "Mi negocio",
      modules: [
        AGENDA,
        SERVICES,
        ...(menu ? [TEAM] : []),
        { label: "Productos", icon: Boxes },
        REPORTS,
        EXPENSES,
        INVOICES,
        PAYMENTS,
        PAYROLL,
      ],
    },
    {
      title: "Marketing y ventas",
      modules: [
        { label: "Promociones", icon: Tag },
        { label: "Combos", icon: Gift },
        SAMPLES,
        CLIENTS,
        STATS,
        { label: "Campañas WhatsApp", icon: Megaphone },
      ],
    },
    { title: "Red profesional", modules: [COURSES] },
  ];
}

export const OWNER_SECTIONS = ownerSections(false);
export const OWNER_MENU_SECTIONS = ownerSections(true);

// Inicio del profesional (US-007, captura 142c): dos tarjetas sin título.
export const STAFF_SECTIONS: ModuleSection[] = [
  { title: null, modules: [AGENDA, REPORTS, INVOICES, COURSES] },
  { title: null, modules: [SAMPLES] },
];
