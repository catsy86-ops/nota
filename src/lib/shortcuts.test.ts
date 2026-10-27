import { describe, expect, it } from "vitest";
import { shortcutFor, SHORTCUT_GROUPS } from "./shortcuts";

describe("skróty w podpowiedziach (plan 3.8)", () => {
  it("bierze skrót z tej samej tabeli co okno skrótów", () => {
    expect(shortcutFor("Paleta poleceń")).toMatch(/K$/);
    expect(shortcutFor("Statystyki")).toBe("Alt+I");
  });

  it("nieznana akcja nie ma skrótu", () => {
    expect(shortcutFor("Nie ma takiej akcji")).toBeUndefined();
  });

  it("każda pozycja z tabeli ma niepuste klawisze", () => {
    for (const g of SHORTCUT_GROUPS) for (const i of g.items) expect(i.keys.length).toBeGreaterThan(0);
  });
});
