/**
 * Spadek rury z czujnika orientacji telefonu (B3.4). Czyste funkcje; odczyt czujnika jest w `LevelMeter.tsx`.
 * To sprawdzenie, nie pomiar: czujniki telefonu mylą się o ok. 0,1–0,2°, co przy spadku rzędu 2% to wciąż kilka dziesiątych procenta.
 */

/** Zalecany spadek poziomych odcinków kanalizacji (najczęściej 2–3%). */
export const SLOPE_OK_MIN = 2;
export const SLOPE_OK_MAX = 3;

/** Spadek w procentach dla kąta w stopniach: tan(kąt)·100, z dokładnością do 0,1. */
export function slopePercent(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return Math.round(Math.tan((deg * Math.PI) / 180) * 1000) / 10;
}

/** Kąt w stopniach dla spadku w procentach (odwrotność `slopePercent`). */
export const slopeDegrees = (percent: number): number => Math.round(((Math.atan(percent / 100) * 180) / Math.PI) * 100) / 100;

export type SlopeZone = "ok" | "off";

/** `ok` w zakresie 2–3% (w obie strony, bo znak zależy od ułożenia telefonu), inaczej `off`. */
export function slopeZone(percent: number): SlopeZone {
  const a = Math.abs(percent);
  return a >= SLOPE_OK_MIN && a <= SLOPE_OK_MAX ? "ok" : "off";
}

/** Filtr dolnoprzepustowy (wygładzanie szumu czujnika): `alpha` 0–1, im mniejsze, tym spokojniejszy odczyt. */
export const smooth = (prev: number | null, next: number, alpha = 0.2): number => (prev === null ? next : prev + alpha * (next - prev));

const pl = (n: number) => String(n).replace(".", ",");

/** „2,1% (1,2°)” do listy wpisów i raportu. */
export const slopeLabel = (deg: number): string => `${pl(Math.abs(slopePercent(deg)))}% (${pl(Math.round(Math.abs(deg) * 10) / 10)}°)`;
