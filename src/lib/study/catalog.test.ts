import { describe, it, expect, beforeEach } from "vitest";
import { catalogFittings, catalogPipes, cleanCatalogPrefs, setCatalogPrefs, SYSTEMS } from "./catalog";
import { PIPE_SUGGESTIONS } from "./pipes";
import { FITTING_SUGGESTIONS, fittingKey } from "./fittings";

describe("katalog systemów (H1.5)", () => {
  beforeEach(() => localStorage.clear());

  it("PEX zostaje w dotychczasowej pisowni — historia i ceny pasują", () => {
    expect(catalogPipes("pex")).toEqual(["Rura PEX 16×2", "Rura PEX 20×2", "Rura PEX 26×3", "Rura PEX 32×3"]);
    for (const p of catalogPipes("pex")) expect(PIPE_SUGGESTIONS).toContain(p);
    for (const f of ["Kolano 16", "Trójnik 16", "Złączka 16", "Kolano naścienne 16"]) expect(FITTING_SUGGESTIONS).toContain(f);
    expect(catalogFittings("pex", "16")).toEqual(["Kolano 16", "Trójnik 16", "Złączka 16", "Kolano naścienne 16"]);
  });

  it("nazwy nie powtarzają się między systemami (sumy i ceny się nie mieszają)", () => {
    const all = SYSTEMS.flatMap((s) => [...s.sizes.map(s.pipe), ...s.sizes.flatMap(s.fittings)]).map(fittingKey);
    expect(new Set(all).size).toBe(all.length);
  });

  it("nieznana średnica daje pierwszą z systemu", () => {
    expect(catalogFittings("pp", "16")).toEqual(catalogFittings("pp", "20"));
  });

  it("preferencje: śmieci → PEX 16, zła średnica → pierwsza z systemu", () => {
    const d = { system: "pex" as const, size: "16" };
    expect(cleanCatalogPrefs(d, "x")).toEqual({ system: "pex", size: "16" });
    expect(cleanCatalogPrefs(d, { system: "cu", size: "99" })).toEqual({ system: "cu", size: "15" });
    setCatalogPrefs({ system: "kan" });
    expect(JSON.parse(localStorage.getItem("kaczy.study.catalog.v1")!)).toEqual({ system: "kan", size: "50" });
    setCatalogPrefs({ size: "110" });
    expect(JSON.parse(localStorage.getItem("kaczy.study.catalog.v1")!)).toEqual({ system: "kan", size: "110" });
  });
});
