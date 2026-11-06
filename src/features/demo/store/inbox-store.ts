import { create } from "zustand";

// Si la bandeja de la demo está abierta (la abren su botón y el aviso del SMS), y un contador que
// sube con cada código pedido, para que la bandeja sin sesión lo busque al momento (US-004).
interface InboxState {
  open: boolean;
  codeVersion: number;
  setOpen: (open: boolean) => void;
  codeSent: () => void;
}

export const useInboxStore = create<InboxState>((set) => ({
  open: false,
  codeVersion: 0,
  setOpen: (open) => set({ open }),
  codeSent: () => set((state) => ({ codeVersion: state.codeVersion + 1 })),
}));
