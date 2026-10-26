import { describe, expect, it } from "vitest";
import { cleanCaptions, cleanEntry } from "./yStudy";

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);

describe("podpisy zdjęć wpisu (P-1)", () => {
  it("zostają tylko podpisy zdjęć, które są we wpisie; tekst przycięty i bez nadmiaru spacji", () => {
    const out = cleanCaptions({ [A]: "  Łazienka   pion ", [B]: "x".repeat(120), [C]: "   ", ["d".repeat(64)]: "obcy" }, [A, B, C]);
    expect(out[A]).toBe("Łazienka pion");
    expect(out[B].length).toBe(80);
    expect(out[C]).toBeUndefined();
    expect(Object.keys(out)).toEqual([A, B]);
  });

  it("nieprawidłowe kształty daja pusty słownik, a zdjęcie zostaje", () => {
    expect(cleanCaptions("nie-obiekt", [A])).toEqual({});
    expect(cleanCaptions([A], [A])).toEqual({});
  });

  it("wpis z podpisem przechodzi przez cleanEntry; bez podpisu pole nie pojawia się", () => {
    const base = { id: "e1", at: 1_700_000_000_000, kind: "ok", text: "praca", site: "Dom", images: [A], checked: [] };
    const withCap = cleanEntry({ ...base, captions: { [A]: "Pion 58 cm" } });
    expect(withCap?.captions).toEqual({ [A]: "Pion 58 cm" });
    const without = cleanEntry({ ...base });
    expect(without && "captions" in without).toBe(false);
  });
});
