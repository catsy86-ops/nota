import { describe, expect, it } from "vitest";
import { hoursLabel, quoteVsActual } from "./quoteVsActual";
import type { QuoteItem } from "./jobs";

const item = (id: string, kind: QuoteItem["kind"], qty: number, price: number): QuoteItem => ({ id, kind, name: id, qty, unit: "szt.", price, order: 0 });
// Wycena: robocizna 2 × 100 = 200, materiał w cenach zakupu 1 × 250 = 250 (marża 20% dolicza się klientowi, nie wchodzi do porównania).
const job = { margin: 20, items: [item("r", "labor", 2, 100), item("m", "material", 1, 250)] };

describe("quoteVsActual (5.2)", () => {
  it("bez zużycia i bez godzin nie ma danych", () => {
    const v = quoteVsActual(job, { cost: null, unpriced: 0 }, undefined, undefined);
    expect(v).toMatchObject({ quotedMaterial: 250, quotedLabor: 200, usedMaterial: null, materialDiff: null, actualLabor: null, laborDiff: null, totalDiff: null, hasData: false });
  });

  it("materiał: różnica w cenach zakupu, dodatnia = drożej niż w wycenie", () => {
    const v = quoteVsActual(job, { cost: 280, unpriced: 2 }, undefined, undefined);
    expect(v).toMatchObject({ usedMaterial: 280, materialDiff: 30, unpriced: 2, totalDiff: 30, hasData: true });
    expect(quoteVsActual(job, { cost: 200, unpriced: 0 }, undefined, undefined).materialDiff).toBe(-50);
  });

  it("robocizna: godziny z karty × stawka kontra wyceniona kwota", () => {
    const v = quoteVsActual(job, { cost: null, unpriced: 0 }, [{ id: "2026-11-10", minutes: 120 }, { id: "2026-11-11", minutes: 90 }], 80);
    expect(v).toMatchObject({ hours: 3.5, rate: 80, actualLabor: 280, laborDiff: 80, totalDiff: 80, hasData: true });
  });

  it("godziny bez stawki: pokazuje godziny, ale nie liczy kwoty ani różnicy", () => {
    const v = quoteVsActual(job, { cost: null, unpriced: 0 }, [{ id: "2026-11-10", minutes: 600 }], undefined);
    expect(v).toMatchObject({ hours: 10, rate: null, actualLabor: null, laborDiff: null, totalDiff: null, hasData: true });
  });

  it("razem: suma różnic materiału i robocizny, także gdy jedna jest ujemna", () => {
    const v = quoteVsActual(job, { cost: 200, unpriced: 0 }, [{ id: "d", minutes: 300 }], 50);
    // Materiał −50, robocizna 5 h × 50 = 250 − 200 = +50.
    expect(v).toMatchObject({ materialDiff: -50, laborDiff: 50, totalDiff: 0 });
  });

  it("zaokrągla do groszy", () => {
    const v = quoteVsActual({ items: [item("r", "labor", 1, 100)] }, { cost: null, unpriced: 0 }, [{ id: "d", minutes: 20 }], 33.33);
    expect(v.actualLabor).toBe(11.11);
    expect(v.laborDiff).toBe(-88.89);
  });
});

describe("hoursLabel", () => {
  it("godziny i minuty bez zbędnych zer", () => {
    expect(hoursLabel(3.5)).toBe("3 h 30 min");
    expect(hoursLabel(2)).toBe("2 h");
    expect(hoursLabel(0.25)).toBe("15 min");
    expect(hoursLabel(0)).toBe("0 h");
  });
});
