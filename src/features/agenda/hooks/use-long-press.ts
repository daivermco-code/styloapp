"use client";

import { type PointerEvent, type MouseEvent, useEffect, useRef } from "react";

const HOLD_MS = 500;
const TOLERANCE_PX = 8;

interface Press {
  x: number;
  y: number;
  /** Distancia desde arriba del elemento donde empezó. */
  offsetY: number;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Mantener presionado (Blueprint, notas de la Fase 4): eventos de puntero, que sirven con mouse y
 * con el dedo. Dispara a los 500 ms y se cancela si el dedo se mueve más de 8 px (así no pelea
 * con el desplazamiento de la grilla). El clic derecho y el menú del navegador al mantener
 * presionado en Android disparan lo mismo. Después de disparar, `consumeClick()` dice que el clic
 * que sigue al soltar no cuenta.
 */
export function useLongPress<T extends string>(
  onLongPress: (key: T, offsetY: number) => void,
) {
  const press = useRef<Press | null>(null);
  const fired = useRef(false);
  const callback = useRef(onLongPress);
  useEffect(() => {
    callback.current = onLongPress;
  });
  useEffect(() => {
    const current = press;
    return () => {
      if (current.current) clearTimeout(current.current.timer);
    };
  }, []);

  function cancel() {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  }

  function fire(key: T, offsetY: number) {
    cancel();
    fired.current = true;
    callback.current(key, offsetY);
  }

  function offsetOf(event: MouseEvent<HTMLElement>): number {
    return event.clientY - event.currentTarget.getBoundingClientRect().top;
  }

  /** Las citas y los bloqueos tienen su propio toque: mantenerlos presionados no cuenta. */
  function onControl(event: MouseEvent<HTMLElement>): boolean {
    return (
      event.target instanceof Element &&
      event.target.closest("a, button, [data-block]") !== null
    );
  }

  function bind(key: T) {
    return {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        cancel();
        fired.current = false;
        if (event.button !== 0 || onControl(event)) return;
        const offsetY = offsetOf(event);
        press.current = {
          x: event.clientX,
          y: event.clientY,
          offsetY,
          timer: setTimeout(() => fire(key, offsetY), HOLD_MS),
        };
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const current = press.current;
        if (
          current &&
          Math.hypot(event.clientX - current.x, event.clientY - current.y) >
            TOLERANCE_PX
        ) {
          cancel();
        }
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu(event: MouseEvent<HTMLElement>) {
        if (onControl(event)) return;
        event.preventDefault();
        if (fired.current && !press.current) return;
        fire(key, press.current?.offsetY ?? offsetOf(event));
      },
    };
  }

  /** True si el clic viene de soltar después de mantener presionado (y lo olvida). */
  function consumeClick(): boolean {
    const was = fired.current;
    fired.current = false;
    return was;
  }

  return { bind, consumeClick };
}
