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

/**
 * Rury do pojemności: średnica zewnętrzna × ścianka [mm], średnica wewnętrzna wynika z wymiaru.
 * Wymiary nominalne (H6.3): PEX i wielowarstwowe jak w materiale; PP-R PN20 (SDR 6) wg PN-EN ISO 15874,
 * miedź wg PN-EN 1057. Sprawdź nadruk na rurze — ścianka zależy od klasy ciśnienia.
 */
export const PIPES: { id: string; label: string; od: number; wall: number; innerMm: number }[] = (
  [
    ["16x2", "16×2", 16, 2],
    ["20x2", "20×2", 20, 2],
    ["25x2.5", "25×2,5", 25, 2.5],
    ["32x3", "32×3", 32, 3],
    ["pp20x3.4", "PP 20×3,4", 20, 3.4],
    ["pp25x4.2", "PP 25×4,2", 25, 4.2],
    ["pp32x5.4", "PP 32×5,4", 32, 5.4],
    ["cu15x1", "Cu 15×1", 15, 1],
    ["cu18x1", "Cu 18×1", 18, 1],
    ["cu22x1", "Cu 22×1", 22, 1],
    ["cu28x1", "Cu 28×1", 28, 1],
  ] as const
).map(([id, label, od, wall]) => ({ id, label, od, wall, innerMm: Math.round((od - 2 * wall) * 10) / 10 }));

/** Pojemność odcinka [l]: π·(d/2)²·L, d w mm, L w m (1 l = 1 dm³). */
export const pipeLiters = (innerMm: number, lengthM: number) => Math.PI * (innerMm / 200) ** 2 * (lengthM * 10);
