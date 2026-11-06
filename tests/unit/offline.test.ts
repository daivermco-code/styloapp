// Fase 11 (T-11.3.1): saber si hay conexión y reconocer el error de la red al guardar.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getOnline,
  getServerOnline,
  subscribeOnline,
  useOnline,
} from "@/shared/hooks/use-online";
import { isNetworkError } from "@/shared/lib/network-error";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useOnline", () => {
  it("lee la conexión del navegador", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(getOnline()).toBe(false);
    vi.stubGlobal("navigator", { onLine: true });
    expect(getOnline()).toBe(true);
  });

  it("avisa al perder y al recuperar la conexión, y deja de avisar al soltar", () => {
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    const onChange = vi.fn();

    const unsubscribe = subscribeOnline(onChange);
    target.dispatchEvent(new Event("offline"));
    target.dispatchEvent(new Event("online"));
    expect(onChange).toHaveBeenCalledTimes(2);

    unsubscribe();
    target.dispatchEvent(new Event("offline"));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("en el servidor dice que hay conexión: la franja no sale en el HTML", () => {
    expect(getServerOnline()).toBe(true);
    function Probe() {
      return createElement(
        "p",
        null,
        useOnline() ? "en línea" : "sin conexión",
      );
    }
    expect(renderToString(createElement(Probe))).toContain("en línea");
  });
});

describe("isNetworkError", () => {
  it("sin conexión, cualquier error es de la red", () => {
    expect(isNetworkError(new Error("lo que sea"), false)).toBe(true);
    expect(isNetworkError("texto", false)).toBe(true);
  });

  it("con conexión, reconoce el pedido que no salió en Chrome, Safari y Firefox", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"), true)).toBe(true);
    expect(isNetworkError(new TypeError("Load failed"), true)).toBe(true);
    expect(
      isNetworkError(
        new TypeError("NetworkError when attempting to fetch resource."),
        true,
      ),
    ).toBe(true);
    expect(isNetworkError(new TypeError("Network request failed"), true)).toBe(
      true,
    );
  });

  it("con conexión, los demás errores no son de la red", () => {
    expect(
      isNetworkError(
        new TypeError("Cannot read properties of undefined"),
        true,
      ),
    ).toBe(false);
    expect(isNetworkError(new Error("Failed to fetch"), true)).toBe(false);
    expect(isNetworkError(null, true)).toBe(false);
  });
});
