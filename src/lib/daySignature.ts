/**
 * Dane „sygnatury dnia” na Dziś (plan motywów 2.5): wszystko liczone lokalnie, bez sieci i lokalizacji.
 * Komponent: `src/components/skins/DaySignature.tsx`.
 */

const SYNODIC_DAYS = 29.530588853;
/** Nów 6.01.2000, 18:14 UTC — punkt odniesienia faz Księżyca. */
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);

export interface MoonPhase {
  /** Wiek Księżyca w dniach od nowiu, 0 ≤ age < 29,53. */
  age: number;
  /** Oświetlona część tarczy, 0 (nów) … 1 (pełnia). */
  illumination: number;
  waxing: boolean;
  name: string;
}

const PHASES: [number, string][] = [
  [1.85, "Nów"],
  [5.54, "Przybywający sierp"],
  [9.23, "Pierwsza kwadra"],
  [12.92, "Przybywający garb"],
  [16.61, "Pełnia"],
  [20.3, "Ubywający garb"],
  [23.99, "Ostatnia kwadra"],
  [27.68, "Ubywający sierp"],
  [Infinity, "Nów"],
];

export function moonPhase(date: Date): MoonPhase {
  const days = (date.getTime() - NEW_MOON_REF) / 86_400_000;
  const age = ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
  const illumination = (1 - Math.cos((2 * Math.PI * age) / SYNODIC_DAYS)) / 2;
  const name = PHASES.find(([limit]) => age < limit)![1];
  return { age, illumination, waxing: age < SYNODIC_DAYS / 2, name };
}

/**
 * Ścieżka SVG oświetlonej części tarczy o promieniu `r` (środek w r,r). Półksiężyc: łuk krawędzi
 * po stronie światła i elipsa terminatora o półosi `r·|1−2·oświetlenie|`.
 */
export function moonPath(phase: MoonPhase, r = 10): string {
  const rx = Math.abs(1 - 2 * phase.illumination) * r;
  const edgeSweep = phase.waxing ? 1 : 0;
  // Terminator wygina się w stronę światła przed kwadrą (sierp), a w przeciwną po kwadrze (garb).
  const termSweep = phase.illumination < 0.5 ? (phase.waxing ? 0 : 1) : (phase.waxing ? 1 : 0);
  const f = (n: number) => +n.toFixed(3);
  return `M${f(r)} 0A${f(r)} ${f(r)} 0 0 ${edgeSweep} ${f(r)} ${f(2 * r)}A${f(rx)} ${f(r)} 0 0 ${termSweep} ${f(r)} 0Z`;
}

/** Część doby, która minęła (0…1) — wskazówka manometru w Hydraulice. */
export function dayProgress(date: Date): number {
  return (date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()) / 86_400;
}
