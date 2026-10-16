/**
 * Kalkulatory na budowę (dział Praca): spadek kanalizacji, próba wodna, pojemność instalacji.
 * Liczby z materiału G-HEAT (`content.ts`): spadek „ok. 2–3%”, próba wodna Ppr = 1,5 × robocze,
 * manometr z zakresem +50% od ciśnienia próbnego i podziałką 0,1 bar. Reszta to geometria.
 * Czyste funkcje; widok w `CalculatorsSheet.tsx`.
 */

/** Typowy zakres spadku kanalizacji z materiału („ok. 2–3% zależnie od średnicy”). */
export const SLOPE_TYPICAL: [number, number] = [2, 3];

/** Liczba z pola: przecinek albo kropka, spacje; pusty, ujemny albo bez liczby → `null`. */
export function parseNum(raw: string): number | null {
  const t = raw.trim().replace(/\s+/g, "").replace(",", ".");
  if (!t || !/^\d*\.?\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Polski zapis liczby: do `digits` miejsc po przecinku, bez zbędnych zer („2,5”, „12”). */
export const plNum = (n: number, digits = 1) => {
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  return r.toLocaleString("pl-PL", { maximumFractionDigits: digits, useGrouping: false });
};

/** Różnica wysokości [cm] na długości [m] przy spadku [%]: 1% = 1 cm na 1 m. */
export const slopeDrop = (lengthM: number, slopePct: number) => lengthM * slopePct;

/** Spadek [%] z różnicy wysokości [cm] na długości [m]; `null` przy zerowej długości. */
export const slopeFromDrop = (lengthM: number, dropCm: number): number | null => (lengthM > 0 ? dropCm / lengthM : null);

/** Spadek poza typowym zakresem z materiału — podpowiedź, nie błąd (zakres zależy od średnicy). */
export const slopeNote = (pct: number): "low" | "high" | null =>
  pct < SLOPE_TYPICAL[0] ? "low" : pct > SLOPE_TYPICAL[1] ? "high" : null;

export interface WaterTest {
  /** Ciśnienie próbne [bar] = 1,5 × robocze. */
  testBar: number;
  /** Najmniejszy zakres manometru [bar] — ciśnienie próbne + 50%. */
  gaugeMinBar: number;
}

/** Próba wodna z ciśnienia roboczego (KAN-therm wg materiału). */
export function waterTest(workingBar: number): WaterTest {
  const testBar = workingBar * 1.5;
  return { testBar, gaugeMinBar: testBar * 1.5 };
}

/** Rury do pojemności: średnica zewnętrzna × ścianka [mm] — średnica wewnętrzna wynika z wymiaru. */
export const PIPES: { id: string; label: string; innerMm: number }[] = [
  { id: "16x2", label: "16×2", innerMm: 12 },
  { id: "20x2", label: "20×2", innerMm: 16 },
  { id: "25x2.5", label: "25×2,5", innerMm: 20 },
  { id: "32x3", label: "32×3", innerMm: 26 },
];

/** Pojemność odcinka [l]: π·(d/2)²·L, d w mm, L w m (1 l = 1 dm³). */
export const pipeLiters = (innerMm: number, lengthM: number) => Math.PI * (innerMm / 200) ** 2 * (lengthM * 10);
