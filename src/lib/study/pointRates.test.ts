import { describe, expect, it } from "vitest";
import { billingStatement, monthSiteEarnings, type SiteBilling } from "./billing";
import { cleanPoint, newPoint, POINT_RATE_MAX, toggleStep, withFrozenRate } from "./points";

// D-A4 (B4 audytu 2): stawka za punkt zamrażana w chwili ukończenia — zmiana stawki nie przelicza punktów wstecz.
const bill = (over: Partial<SiteBilling> = {}): SiteBilling => ({ modes: ["points"], typeRates: {}, stageAmounts: {}, payments: [], ...over });
const label = (t: string) => t;

describe("zamrożona stawka punktu (D-A4)", () => {
  it("ukończenie zapisuje stawkę z tej chwili; dalsze zmiany jej nie ruszają; cofnięcie ją zdejmuje", () => {
    const p = newPoint("p1", "r1", "umywalka", 0);
    const twoSteps = toggleStep(p, 1, 1);
    expect(withFrozenRate(p, twoSteps, 150).rate).toBeUndefined();
    const finished = withFrozenRate(twoSteps, toggleStep(twoSteps, 2, 2), 150);
    expect(finished.rate).toBe(150);
    // Zrobiony dalej (np. zmiana wysokości zapisana tą samą ścieżką) — stawka z chwili ukończenia, nie bieżąca.
    expect(withFrozenRate(finished, { ...finished, height: 90 }, 200).rate).toBe(150);
    const undone = withFrozenRate(finished, toggleStep(finished, 2, 3), 200);
    expect(undone.rate).toBeUndefined();
    // Ukończenie bez stawki w tej chwili — pole nie powstaje (liczy się bieżąca, gdy się pojawi).
    expect(withFrozenRate(twoSteps, toggleStep(twoSteps, 2, 2), undefined)).not.toHaveProperty("rate");
  });

  it("cleanPoint: stawka dodatnia do limitu, zaokrąglona do groszy; śmieci odrzucone", () => {
    const base = { ...newPoint("p1", "r1", "umywalka", 0) };
    expect(cleanPoint({ ...base, rate: 149.999 })?.rate).toBe(150);
    for (const bad of [0, -5, Number.NaN, "150", POINT_RATE_MAX + 1]) expect(cleanPoint({ ...base, rate: bad })).not.toHaveProperty("rate");
  });

  it("zestawienie: zamrożona stawka wygrywa z bieżącą; ten sam rodzaj po dwóch stawkach — dwa wiersze", () => {
    const st = billingStatement({
      billing: bill({ pointRate: 200 }), minutes: 0, unsplit: 0, stages: [], typeLabel: label,
      points: [
        { type: "umywalka", done: true, rate: 150 },
        { type: "umywalka", done: true, rate: 150 },
        { type: "umywalka", done: true },
        { type: "umywalka", done: false, rate: 999 },
      ],
    });
    expect(st.lines.map((l) => [l.detail, l.amount])).toEqual([["2 × 150 zł", 300], ["1 × 200 zł", 200]]);
    expect(st.accrued).toBe(500);
  });

  it("zarobek miesiąca liczy punkt po stawce z chwili ukończenia", () => {
    const e = monthSiteEarnings({ billing: bill({ pointRate: 200 }), points: [{ type: "wc", doneAt: 5, rate: 120 }, { type: "wc", doneAt: 6 }], stages: [] }, 0, 10);
    expect(e.points).toEqual({ count: 2, amount: 320 });
  });

});
