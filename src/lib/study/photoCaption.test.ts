import { describe, expect, it } from "vitest";
import { CAPTION_MAX, captionLayout, captionText } from "./photoCaption";

// Przybliżenie szerokości tekstu: 0,55 em na znak.
const measure = (s: string, font: number) => s.length * font * 0.55;

describe("podpis zdjęcia z budowy", () => {
  it("czcionka rośnie z krótszym bokiem, minimum 14 px", () => {
    expect(captionLayout(4000, 3000, "Łazienka", measure).font).toBe(135);
    expect(captionLayout(200, 150, "Łazienka", measure).font).toBe(14);
  });

  it("krótki tekst w jednej linii, długi łamany na dwie z wielokropkiem", () => {
    expect(captionLayout(1600, 1200, "Łazienka, 58 cm", measure).lines).toEqual(["Łazienka, 58 cm"]);
    const long = captionLayout(400, 300, "Łazienka parter pion kanalizacyjny przy ścianie zewnętrznej 58 cm od posadzki, obok okna, za stelażem WC i przed wanną", measure);
    expect(long.lines).toHaveLength(2);
    expect(long.lines[1].endsWith("…")).toBe(true);
    for (const l of long.lines) expect(measure(l, long.font)).toBeLessThanOrEqual(400 - long.pad * 2);
  });

  it("captionText dokleja datę wpisu, przycina tekst, pusty = sama data", () => {
    const at = new Date(2026, 9, 15, 12).getTime();
    expect(captionText(" Kuchnia, 48 cm ", at)).toBe("Kuchnia, 48 cm · 15.10.2026");
    expect(captionText("", at)).toBe("15.10.2026");
    expect(captionText("x".repeat(200), at).length).toBe(CAPTION_MAX + " · 15.10.2026".length);
  });
});
