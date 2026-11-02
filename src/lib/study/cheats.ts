/**
 * H6.3 i H6.4 Ściągi i wydłużenie cieplne (dział Praca, okno „Kalkulatory”). Każda liczba ze źródłem:
 * gwinty z normy, ciśnienie z definicji jednostek, współczynniki wydłużenia z kart producentów
 * (wartości typowe — do potwierdzenia w karcie konkretnego systemu, dlatego pole w kalkulatorze
 * da się zmienić). Czyste dane i funkcje; widok w `CalculatorsSheet.tsx`.
 */

export interface PipeThread {
  /** Rozmiar w calach, jak na kształtce. */
  inch: string;
  /** Zwyczajowy odpowiednik DN. */
  dn: number;
  /** Średnica zewnętrzna gwintu [mm]. */
  majorMm: number;
  /** Zwoje na cal. */
  tpi: number;
}

/** Gwint rurowy walcowy G (BSP) — średnica zewnętrzna i skok wg PN-EN ISO 228-1. */
export const PIPE_THREADS: readonly PipeThread[] = [
  { inch: "1/8", dn: 6, majorMm: 9.728, tpi: 28 },
  { inch: "1/4", dn: 8, majorMm: 13.157, tpi: 19 },
  { inch: "3/8", dn: 10, majorMm: 16.662, tpi: 19 },
  { inch: "1/2", dn: 15, majorMm: 20.955, tpi: 14 },
  { inch: "3/4", dn: 20, majorMm: 26.441, tpi: 14 },
  { inch: "1", dn: 25, majorMm: 33.249, tpi: 11 },
  { inch: "1 1/4", dn: 32, majorMm: 41.91, tpi: 11 },
  { inch: "1 1/2", dn: 40, majorMm: 47.803, tpi: 11 },
  { inch: "2", dn: 50, majorMm: 59.614, tpi: 11 },
];

export const THREADS_SOURCE = "PN-EN ISO 228-1 (gwint G): średnica zewnętrzna i zwoje na cal; DN — zwyczajowy odpowiednik. „1/2 cala” to nazwa rozmiaru, nie 12,7 mm.";

export type PressureUnit = "bar" | "MPa" | "kPa" | "mH2O" | "psi";

/** Ile kPa ma jednostka — z definicji (1 m H₂O umowny: 9,80665 kPa). */
export const PRESSURE_KPA: Readonly<Record<PressureUnit, number>> = { bar: 100, MPa: 1000, kPa: 1, mH2O: 9.80665, psi: 6.894757 };

export const PRESSURE_LABEL: Readonly<Record<PressureUnit, string>> = { bar: "bar", MPa: "MPa", kPa: "kPa", mH2O: "m H₂O", psi: "psi" };

export const PRESSURE_UNITS = Object.keys(PRESSURE_KPA) as PressureUnit[];

export const PRESSURE_SOURCE = "Z definicji jednostek: 1 bar = 100 kPa = 0,1 MPa; 1 m słupa wody = 9,80665 kPa (umowny); 1 psi = 6,894757 kPa. 10 m wysokości ≈ 1 bar.";

export const convertPressure = (value: number, from: PressureUnit, to: PressureUnit) => (value * PRESSURE_KPA[from]) / PRESSURE_KPA[to];

export interface ExpansionMaterial {
  id: string;
  label: string;
  /** Współczynnik wydłużenia [mm/(m·K)]. */
  mmPerMK: number;
  source: string;
}

/**
 * Współczynniki wydłużenia cieplnego — wartości typowe z kart technicznych systemów (KAN-therm,
 * Rehau, Uponor), dla miedzi z własności materiału (ok. 16,8·10⁻⁶ 1/K). Do potwierdzenia w karcie
 * systemu, którego używasz.
 */
export const EXPANSION: readonly ExpansionMaterial[] = [
  { id: "pex", label: "PEX", mmPerMK: 0.15, source: "karty PE-X: 0,15–0,20" },
  { id: "pex-al", label: "Wielowarstwowa (z Al)", mmPerMK: 0.025, source: "karty PEX/Al/PEX i PE-RT/Al/PE-RT" },
  { id: "pp", label: "PP-R", mmPerMK: 0.15, source: "karty PP-R" },
  { id: "pp-stabi", label: "PP-R stabilizowana (Al)", mmPerMK: 0.03, source: "karty PP-R Stabi" },
  { id: "cu", label: "Miedź", mmPerMK: 0.017, source: "miedź: 16,8·10⁻⁶ 1/K" },
];

/** Wydłużenie [mm] = α [mm/(m·K)] × L [m] × ΔT [K]. */
export const thermalExpansionMm = (mmPerMK: number, lengthM: number, deltaK: number) => mmPerMK * lengthM * deltaK;
