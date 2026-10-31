import { describe, expect, it } from "vitest";
import { contrastRatio, formatOklch, parseOklch, type Oklch } from "@/lib/oklch";
import { generate, type Group, type Tokens } from "@/lib/customTheme";

// Generator własnego motywu (plan motywów 4.1): odcień zmienia tylko barwę, jasność ustala generator,
// a każdy przechodzący wynik trzyma kontrast AA (4,5:1) w parach, które pilnuje grupa.

const LIGHT: Tokens = {
  background: [0.975, 0.002, 250],
  card: [1, 0, 0],
  foreground: [0.22, 0.01, 260],
  "muted-foreground": [0.47, 0.01, 260],
  "destructive-ink": [0.5314, 0.1989, 27.39],
  primary: [0.47, 0.17, 262],
  "primary-foreground": [1, 0, 0],
};

const DARK: Tokens = {
  background: [0.32, 0.045, 162],
  card: [0.36, 0.045, 162],
  foreground: [0.95, 0.012, 95],
  "muted-foreground": [0.8, 0.012, 95],
  "destructive-ink": [0.82, 0.11, 25],
  primary: [0.86, 0.14, 80],
  "primary-foreground": [0.2, 0.04, 160],
};

const PAIRS: Record<Group, [string, string][]> = {
  paper: [["foreground", "background"], ["muted-foreground", "background"], ["destructive-ink", "background"]],
  tile: [["foreground", "card"], ["muted-foreground", "card"], ["destructive-ink", "card"]],
  accent: [["primary-foreground", "primary"]],
};

const hues = (h: number): Record<Group, number> => ({ paper: h, tile: h, accent: h });

describe("generator własnego motywu", () => {
  it("odcień zmienia barwę, a jasność zostaje, gdy kontrast przechodzi", () => {
    const { tokens, failing } = generate(LIGHT, hues(100));
    expect(failing).toEqual([]);
    expect(tokens.background[0]).toBeCloseTo(LIGHT.background[0], 6);
    expect(tokens.background[2]).toBeCloseTo(100, 6);
    expect(tokens.card[2]).toBeCloseTo(100, 6);
  });

  for (const [name, base] of [["jasny", LIGHT], ["ciemny", DARK]] as const) {
    it(`${name}: każdy odcień 0–359 daje parę ≥ 4,5:1 albo zostawia bazę`, () => {
      for (let h = 0; h < 360; h += 15) {
        const { tokens, failing } = generate(base, hues(h));
        for (const group of ["paper", "tile", "accent"] as Group[]) {
          if (failing.includes(group)) {
            expect(tokens[group === "accent" ? "primary" : group === "paper" ? "background" : "card"]).toEqual(base[group === "accent" ? "primary" : group === "paper" ? "background" : "card"]);
            continue;
          }
          for (const [fg, bg] of PAIRS[group]) {
            expect(contrastRatio(tokens[fg] as Oklch, tokens[bg] as Oklch), `${group} h=${h} ${fg}/${bg}`).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    });
  }

  it("akcent przechodzi dla każdego odcienia (jasna i ciemna baza)", () => {
    for (let h = 0; h < 360; h += 5) {
      expect(generate(LIGHT, hues(h)).failing, `jasny h=${h}`).not.toContain("accent");
      expect(generate(DARK, hues(h)).failing, `ciemny h=${h}`).not.toContain("accent");
    }
  });

  it("brak tokenu bazowego zgłasza grupę jako niezmienianą", () => {
    const { failing } = generate({ ...LIGHT, card: undefined as unknown as Oklch }, hues(10));
    expect(failing).toContain("tile");
  });
});

describe("zapis OKLCH", () => {
  it("parse po format wraca do tych samych wartości (w zaokrągleniu)", () => {
    const c: Oklch = [0.4731, 0.1234, 261.5];
    const back = parseOklch(formatOklch(c));
    expect(back?.[0]).toBeCloseTo(0.4731, 4);
    expect(back?.[1]).toBeCloseTo(0.1234, 4);
    expect(back?.[2]).toBeCloseTo(261.5, 2);
  });
});
