import { describe, it, expect } from "vitest";
import { FRAME_SURFACES, borderValue, surfaceValue, FRAME_COLORS } from "./frameLook";

/** oklch → względna luminancja sRGB (Björn Ottosson, 2020). Do sprawdzenia kontrastu. */
function oklchLuminance(css: string): number {
  const m = /oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/.exec(css);
  if (!m) throw new Error("nie oklch: " + css);
  const L = Number(m[1]);
  const C = Number(m[2]);
  const h = (Number(m[3]) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, c)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

// Tekst karty w obu motywach (index.css: --card-foreground).
const TEXT_LIGHT = oklchLuminance("oklch(0.2486 0.0195 264.13)");
const TEXT_DARK = oklchLuminance("oklch(0.9277 0.0092 76.60)");

describe("tło ramek: kontrast z tekstem karty", () => {
  for (const [id, s] of Object.entries(FRAME_SURFACES)) {
    const light = s.light;
    const dark = s.dark;
    if (!light || !dark) continue;
    it(`„${s.label}” (${id}) jest czytelne w jasnym motywie (≥ 4,5:1)`, () => {
      expect(contrast(oklchLuminance(light), TEXT_LIGHT)).toBeGreaterThanOrEqual(4.5);
    });
    it(`„${s.label}” (${id}) jest czytelne w ciemnym motywie (≥ 4,5:1)`, () => {
      expect(contrast(oklchLuminance(dark), TEXT_DARK)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("borderValue", () => {
  it("„Motyw” zostawia kolor motywu (null)", () => {
    expect(borderValue("theme")).toBeNull();
  });

  it("wybrany kolor miesza się przez --frame-mix, żeby siła z ustawienia „Ramki” działała", () => {
    expect(borderValue("blue")).toBe(`color-mix(in oklab, ${FRAME_COLORS.blue.hex} var(--frame-mix), transparent)`);
  });
});

describe("surfaceValue", () => {
  it("„Motyw” nie nadpisuje tła", () => {
    expect(surfaceValue("theme", false)).toBeNull();
    expect(surfaceValue("theme", true)).toBeNull();
  });

  it("ten sam wybór daje inne tło w jasnym i ciemnym motywie", () => {
    expect(surfaceValue("mint", false)).not.toBe(surfaceValue("mint", true));
  });
});
