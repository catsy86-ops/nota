import { describe, expect, it } from "vitest";
import { hasMath } from "./mathHint";

describe("hasMath", () => {
  it("rozpoznaje wzór w linii i blokowy", () => {
    expect(hasMath("Pole koła to $\\pi r^2$ i tyle.")).toBe(true);
    expect(hasMath("$x$")).toBe(true);
    expect(hasMath("$$\n\\int_0^1 x\\,dx\n$$")).toBe(true);
  });

  it("nie bierze cen za wzór", () => {
    expect(hasMath("kosztuje $5 i $10")).toBe(false);
    expect(hasMath("zapłacono $ 5 oraz $ 7")).toBe(false);
    expect(hasMath("sam znak $ w tekście")).toBe(false);
  });

  it("pomija zwykły tekst i znak ucieczki", () => {
    expect(hasMath("bez dolarów")).toBe(false);
    expect(hasMath("cena \\$5 oraz \\$6")).toBe(false);
  });
});
