"use client";

import { useEffect } from "react";
import { recordProfileVisit } from "../services/actions";

const VISITED = "styloapp:visita:";

/** Ya contó esta pestaña. Sin sessionStorage (modo privado estricto), cuenta cada vez. */
function alreadyCounted(businessId: string): boolean {
  try {
    const key = `${VISITED}${businessId}`;
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, "1");
  } catch {
    // Sin almacenamiento la visita se cuenta igual.
  }
  return false;
}

// Cuenta la visita a la página del negocio (US-058, T-14.1.1) al abrirla en la app o por el
// enlace, una vez por pestaña: recargar o volver no suma otra. No pinta nada.
export function VisitCounter({ businessId }: { businessId: string }) {
  useEffect(() => {
    if (!alreadyCounted(businessId)) void recordProfileVisit(businessId);
  }, [businessId]);
  return null;
}
