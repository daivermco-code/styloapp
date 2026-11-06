"use client";

import { ArrowRight, SquarePen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClientPicker } from "@/features/agenda/components/client-picker";
import type {
  AgendaClient,
  BookingCategoryOption,
} from "@/features/agenda/types/agenda";
import { TopBar } from "@/shared/components/top-bar";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import {
  type InvoiceStep,
  InvoiceDraftProvider,
  useInvoiceDraft,
} from "../store/invoice-draft";
import type { InvoiceMethodOption, InvoiceSeed } from "../types/invoice";
import { InvoiceItemsStep } from "./invoice-items-step";
import { InvoicePaymentStep } from "./invoice-payment-step";

const STEP_TITLES: Record<InvoiceStep, string> = {
  1: "Asocia un cliente",
  2: "Asocia servicios y productos",
  3: "Pago de la factura",
};

interface InvoiceEditorProps {
  seed: InvoiceSeed;
  categories: BookingCategoryOption[];
  clients: AgendaClient[];
  canCreateClients: boolean;
  /** El dueño elige el profesional de cada servicio; el profesional va fijo él. */
  canPickStaff: boolean;
  methods: InvoiceMethodOption[];
  commissions: Record<string, number> | null;
  /** A dónde lleva salir: Facturas, la cita o la factura que se edita. */
  exitHref: string;
}

/** "¿Salir de la factura?" (UI pantalla 8, captura 63): centrada, con X y "Salir". */
function LeaveDialog({
  open,
  onOpenChange,
  onLeave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-32px)] max-w-sm rounded-card">
        <DialogHeader className="items-center text-center">
          <DialogTitle className="text-18 font-bold text-primary">
            ¿Salir de la factura?
          </DialogTitle>
          <DialogDescription className="text-14 text-ink">
            Lo que llevas se pierde.
          </DialogDescription>
        </DialogHeader>
        <Button type="button" onClick={onLeave} className="justify-self-center">
          Salir
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Un enlace interno tocado sin teclas: el que se lleva el borrador sin pasar por la flecha. */
function internalLink(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }
  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest("a[href]");
  if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") {
    return null;
  }
  if (link.origin !== window.location.origin) return null;
  return `${link.pathname}${link.search}`;
}

/**
 * Con cambios, toda salida pasa por la flecha (US-040, "Salir con cambios pregunta"): el atrás del
 * navegador o de Android (una entrada de guarda en el historial), los enlaces de afuera del
 * editor, como el menú lateral del computador, y cerrar o recargar la pestaña (ahí el texto lo
 * pone el navegador).
 */
function useLeaveGuard(
  dirty: boolean,
  onBack: () => void,
  onLink: (href: string) => void,
) {
  const handlers = useRef({ onBack, onLink });
  useEffect(() => {
    handlers.current = { onBack, onLink };
  });

  useEffect(() => {
    if (!dirty) return;
    // Copia el estado de Next: al volver a esta entrada, el router se queda en la misma página.
    const guard = () =>
      window.history.pushState(window.history.state, "", window.location.href);
    guard();
    const onPop = () => {
      guard();
      handlers.current.onBack();
    };
    const onClick = (event: MouseEvent) => {
      const href = internalLink(event);
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      handlers.current.onLink(href);
    };
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("popstate", onPop);
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty]);
}

/**
 * La flecha de cada paso: el 3 vuelve al 2 y el 2 al 1 (si no viene de una cita, que trae su
 * cliente). Desde el primer paso se sale, y con cambios pregunta antes.
 */
function useStepBack(fromBooking: boolean, exitHref: string) {
  const router = useRouter();
  const step = useInvoiceDraft((state) => state.step);
  const dirty = useInvoiceDraft((state) => state.dirty);
  const goTo = useInvoiceDraft((state) => state.goTo);
  // A dónde va "Salir": la salida del editor o el enlace que se tocó.
  const [leaving, setLeaving] = useState<string | null>(null);

  const back = () => {
    if (step === 3) return goTo(2);
    if (step === 2 && !fromBooking) return goTo(1);
    if (dirty) return setLeaving(exitHref);
    router.push(exitHref);
  };
  const askFor = useCallback((href: string) => setLeaving(href), []);
  useLeaveGuard(dirty, back, askFor);

  const leave = () => {
    if (leaving) router.push(leaving);
    setLeaving(null);
  };
  const setAsking = (open: boolean) => {
    if (!open) setLeaving(null);
  };
  return { step, back, asking: leaving !== null, setAsking, leave };
}

/** Al cambiar de paso: arriba del panel y el foco en el título nuevo (no al abrir). */
function useStepFocus(step: InvoiceStep) {
  const topRef = useRef<HTMLDivElement>(null);
  // Con el paso de antes y no con "es la primera vez": en desarrollo React corre el efecto dos
  // veces al abrir, y la segunda ya ponía el foco en el título.
  const shown = useRef(step);
  useEffect(() => {
    if (shown.current === step) return;
    shown.current = step;
    const top = topRef.current;
    if (!top) return;
    top.parentElement?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
    const title = top.querySelector("h1");
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  }, [step]);
  return topRef;
}

/** Paso 1 al volver con una ficha ya elegida (editar): seguir con ella sin buscarla. */
function KeepClient() {
  const hydrated = useHydrated();
  const client = useInvoiceDraft((state) => state.client);
  const goTo = useInvoiceDraft((state) => state.goTo);
  if (client?.kind !== "client") return null;
  return (
    <div className="px-5 pt-5">
      <Button
        type="button"
        variant="outline"
        disabled={!hydrated}
        onClick={() => goTo(2)}
        className="w-full justify-between"
      >
        <span className="min-w-0 truncate">Seguir con {client.fullName}</span>
        <ArrowRight />
      </Button>
    </div>
  );
}

function EditorSteps({
  seed,
  categories,
  clients,
  canCreateClients,
  canPickStaff,
  methods,
  commissions,
  exitHref,
}: InvoiceEditorProps) {
  const hydrated = useHydrated();
  const pickClient = useInvoiceDraft((state) => state.pickClient);
  const { step, back, asking, setAsking, leave } = useStepBack(
    seed.bookingId !== null,
    exitHref,
  );
  const topRef = useStepFocus(step);

  return (
    <div ref={topRef}>
      <TopBar
        title={STEP_TITLES[step]}
        icon={<SquarePen />}
        onBack={back}
        backDisabled={!hydrated}
      />
      {step === 1 && (
        <>
          <KeepClient />
          <ClientPicker
            clients={clients}
            canCreate={canCreateClients}
            title={null}
            skipLabel="Continuar sin agregar cliente"
            onPick={(client) =>
              pickClient({
                kind: "client",
                id: client.id,
                fullName: client.fullName,
              })
            }
            onSkip={() => pickClient({ kind: "guest" })}
          />
        </>
      )}
      {step === 2 && (
        <InvoiceItemsStep categories={categories} canPickStaff={canPickStaff} />
      )}
      {step === 3 && (
        <InvoicePaymentStep
          invoiceId={seed.invoiceId}
          bookingId={seed.bookingId}
          bookingStartsAt={seed.bookingStartsAt}
          methods={methods}
          commissions={commissions}
        />
      )}
      <LeaveDialog open={asking} onOpenChange={setAsking} onLeave={leave} />
    </div>
  );
}

// Editor de factura en 3 pasos (T-8.3.1 y T-8.3.2, US-040, US-041 y US-043, pantalla 8): cliente,
// servicios y pago. El borrador vive en un store de la página (sin localStorage) y se va al salir.
// Desde la cita o al editar entra directo al paso 3, con todo puesto.
export function InvoiceEditor(props: InvoiceEditorProps) {
  return (
    <InvoiceDraftProvider seed={props.seed}>
      <EditorSteps {...props} />
    </InvoiceDraftProvider>
  );
}
