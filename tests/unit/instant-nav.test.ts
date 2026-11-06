// Fase 17 (T-17.1.1): qué control se ve elegido mientras llega la pantalla pedida.
import { describe, expect, it } from "vitest";
import { isSelected, paramOf, sameHref } from "@/shared/lib/instant-nav";

describe("paramOf", () => {
  it("lee un parámetro de la dirección", () => {
    expect(paramOf("/pro/agenda?dia=2026-11-06&vista=lista", "vista")).toBe(
      "lista",
    );
    expect(paramOf("/pro/agenda?dia=2026-11-06", "vista")).toBeNull();
    expect(paramOf("/pro/agenda", "dia")).toBeNull();
    expect(paramOf("/pro/informes?pestana=ventas#arriba", "pestana")).toBe(
      "ventas",
    );
  });
});

describe("sameHref", () => {
  it("no importa el orden de los parámetros", () => {
    expect(sameHref("/pro/facturas?a=1&b=2", "/pro/facturas?b=2&a=1")).toBe(
      true,
    );
  });
  it("distingue la ruta y los valores", () => {
    expect(sameHref("/pro/facturas?a=1", "/pro/gastos?a=1")).toBe(false);
    expect(sameHref("/pro/facturas?a=1", "/pro/facturas?a=2")).toBe(false);
    expect(
      sameHref("/pro/servicios", "/pro/servicios?pestana=archivados"),
    ).toBe(false);
  });
});

describe("isSelected", () => {
  const tab = "/pro/servicios?pestana=archivados";
  it("sin nada pendiente, manda el servidor", () => {
    expect(isSelected(true, tab, "pestanas", null)).toBe(true);
    expect(isSelected(false, tab, "pestanas", null)).toBe(false);
  });
  it("si su grupo espera, el elegido es el que se tocó", () => {
    const pending = { href: tab, group: "pestanas" };
    expect(isSelected(false, tab, "pestanas", pending)).toBe(true);
    expect(isSelected(true, "/pro/servicios", "pestanas", pending)).toBe(false);
  });
  it("si espera otro grupo, manda el servidor", () => {
    const pending = { href: "/pro/servicios?x=1", group: "otro" };
    expect(isSelected(true, tab, "pestanas", pending)).toBe(true);
    expect(isSelected(false, tab, "pestanas", pending)).toBe(false);
  });
});
