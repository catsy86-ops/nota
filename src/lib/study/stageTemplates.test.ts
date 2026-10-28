import { describe, expect, it } from "vitest";
import { hasCheckLine, stageTemplate, toggleCheckLine } from "./stageTemplates";

describe("szablony wpisu per etap (P2.9)", () => {
  it("etap domyślny ma swój szablon; własny dopasowany po słowie w nazwie", () => {
    expect(stageTemplate({ id: "proba", name: "Próba szczelności" })?.photos).toContain("Manometr na początku");
    expect(stageTemplate({ id: "s-x1", name: "Druga próba ciśnienia" })?.checklist).toContain("Czas trwania");
    expect(stageTemplate({ id: "s-x2", name: "Malowanie" })).toBeNull();
  });

  it("punkt dopisuje się linią i znika przy drugim stuknięciu", () => {
    let t = toggleCheckLine("Próba pionu", "Czas trwania");
    expect(t).toBe("Próba pionu\n✓ Czas trwania");
    expect(hasCheckLine(t, "Czas trwania")).toBe(true);
    t = toggleCheckLine(t, "Czas trwania");
    expect(t).toBe("Próba pionu");
    expect(toggleCheckLine("", "Wynik")).toBe("✓ Wynik");
  });
});
