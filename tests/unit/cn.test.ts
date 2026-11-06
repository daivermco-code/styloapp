import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("no confunde los tamaños propios con colores de texto", () => {
    expect(cn("text-primary-foreground", "text-16")).toBe(
      "text-primary-foreground text-16",
    );
  });

  it("el último tamaño gana", () => {
    expect(cn("text-14", "text-16")).toBe("text-16");
  });
});
