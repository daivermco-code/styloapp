"use client";

import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useState,
} from "react";
import { createStore, type StoreApi, useStore } from "zustand";
import type { DraftItem } from "../lib/draft";
import type { DraftClient, InvoiceSeed } from "../types/invoice";

// El borrador del editor de factura (T-8.3.1, Blueprint, notas de la Fase 8). Es un store de
// Zustand de la página: nace con el editor y se borra al salir, sin localStorage. Cada visita al
// editor arranca de nuevo con lo que trae la URL (nada, la cita o la factura).

export type InvoiceStep = 1 | 2 | 3;

interface DraftState {
  step: InvoiceStep;
  client: DraftClient | null;
  guestName: string;
  items: DraftItem[];
  methodId: string | null;
  /** Hubo cambios desde que se abrió: salir pregunta. */
  dirty: boolean;
  goTo: (step: InvoiceStep) => void;
  pickClient: (client: DraftClient) => void;
  setGuestName: (name: string) => void;
  /** Marca el servicio con su profesional y valor propuestos, o lo desmarca. */
  toggleItem: (item: DraftItem) => void;
  updateItem: (serviceId: string, change: Partial<DraftItem>) => void;
  setMethod: (methodId: string) => void;
}

export type InvoiceDraftStore = StoreApi<DraftState>;

/** El borrador con lo que trae la URL: la cita o la factura entran al paso 3. */
export function createInvoiceDraft(seed: InvoiceSeed): InvoiceDraftStore {
  return createStore<DraftState>((set) => ({
    step: seed.items.length > 0 ? 3 : 1,
    client: seed.client,
    guestName: seed.guestName,
    items: seed.items,
    methodId: seed.methodId,
    dirty: false,
    goTo: (step) => set({ step }),
    pickClient: (client) => set({ client, step: 2, dirty: true }),
    setGuestName: (guestName) => set({ guestName, dirty: true }),
    toggleItem: (item) =>
      set((state) => ({
        dirty: true,
        items: state.items.some((it) => it.serviceId === item.serviceId)
          ? state.items.filter((it) => it.serviceId !== item.serviceId)
          : [...state.items, item],
      })),
    updateItem: (serviceId, change) =>
      set((state) => ({
        dirty: true,
        items: state.items.map((item) =>
          item.serviceId === serviceId ? { ...item, ...change } : item,
        ),
      })),
    setMethod: (methodId) => set({ methodId, dirty: true }),
  }));
}

const DraftContext = createContext<InvoiceDraftStore | null>(null);

/** Da el borrador al editor; se crea una vez por visita y se va con la página. */
export function InvoiceDraftProvider({
  seed,
  children,
}: {
  seed: InvoiceSeed;
  children: ReactNode;
}) {
  const [store] = useState(() => createInvoiceDraft(seed));
  return createElement(DraftContext.Provider, { value: store }, children);
}

/** Lee una parte del borrador. Solo dentro de InvoiceDraftProvider. */
export function useInvoiceDraft<T>(selector: (state: DraftState) => T): T {
  const store = useContext(DraftContext);
  if (!store)
    throw new Error("useInvoiceDraft va dentro de InvoiceDraftProvider");
  return useStore(store, selector);
}
