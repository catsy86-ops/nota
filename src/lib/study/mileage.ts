/**
 * B4.3: Kilometrówka — trasa dnia z kolejności budów, odległość i stawka za km.
 * Miesięczne zestawienie i CSV dla księgowej.
 */

import { cell } from "@/lib/shifts/timesheet";
import { distanceM } from "./geo";

export interface MileageEntry {
  id: string;
  date: number;              // timestamp (południe wybranego dnia)
  siteIds: string[];         // kolejność budów w dniu
  distance: number;          // km (ręczny wpis z licznika albo przyjęta podpowiedź)
  rate: number;              // stawka za km (zł) z chwili wpisu
  calculatedDistance?: number; // podpowiedź: km w linii prostej × 1,3
}

export interface MileageMonth {
  year: number;
  month: number;             // 1-12
  entries: MileageEntry[];
}

export const MILEAGE_RATE_DEFAULT = 0.65; // zł/km (domyślna stawka)
export const MILEAGE_RATE_MAX = 20;
export const MILEAGE_DISTANCE_MAX = 3000;
export const MILEAGE_ENTRIES_MAX = 2000;
const MILEAGE_SITES_MAX = 20;

/** Odległość w linii prostej (haversine, bo stopień długości w Polsce to ~68 km, nie 111), w km z jednym miejscem. */
export function calculateLinearDistance(
  coords1: [number, number],
  coords2: [number, number]
): number {
  const km = distanceM({ lat: coords1[0], lng: coords1[1], acc: 0 }, { lat: coords2[0], lng: coords2[1], acc: 0 }) / 1000;
  return Math.round(km * 10) / 10;
}

export function suggestMileage(
  geoCoords: Array<[number, number] | undefined>
): number {
  const coords = geoCoords.filter((c) => c !== undefined) as Array<[number, number]>;
  if (coords.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += calculateLinearDistance(coords[i], coords[i + 1]);
  }
  // Mnożymy przez 1,3 bo droga nie jest linia prosta
  return Math.round(total * 1.3 * 10) / 10;
}

export function mileageCost(distance: number, rate: number = MILEAGE_RATE_DEFAULT): number {
  return Math.round(distance * rate * 100) / 100;
}

const csvNum = (n: number) => String(n).replace(".", ",");
const dayIso = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * CSV dla księgowej: BOM, średnik, przecinek dziesiętny i CRLF — jak reszta eksportów, żeby polski Excel
 * otworzył go w kolumnach. `siteName` zamienia id budowy na nazwę w kolumnie „Trasa”.
 */
export function exportMileageCSV(month: MileageMonth, siteName: (id: string) => string = (id) => id): string {
  const rows: string[][] = [["Data", "Trasa", "Liczba budów", "Dystans (km)", "Stawka (zł/km)", "Koszt (zł)"]];
  for (const e of month.entries) {
    rows.push([dayIso(e.date), e.siteIds.map(siteName).join(" → "), String(e.siteIds.length), csvNum(e.distance), csvNum(e.rate), mileageCost(e.distance, e.rate).toFixed(2).replace(".", ",")]);
  }
  const t = mileageTotals(month.entries);
  rows.push([]);
  rows.push(["Razem", "", "", csvNum(t.km), "", t.cost.toFixed(2).replace(".", ",")]);
  return "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

/** Magazyn na urządzeniu: ostatnia stawka (podpowiadana w nowym wpisie) i wpisy. */
export interface MileageStore {
  rate: number;
  entries: MileageEntry[];
}

export const EMPTY_MILEAGE: MileageStore = { rate: MILEAGE_RATE_DEFAULT, entries: [] };

const okNum = (v: unknown, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;

/** Dowolne wejście (localStorage, kopia) → poprawny magazyn; zepsute wpisy odpadają. */
export function cleanMileage(raw: unknown): MileageStore {
  if (!raw || typeof raw !== "object") return EMPTY_MILEAGE;
  const o = raw as Record<string, unknown>;
  const entries: MileageEntry[] = [];
  for (const e of Array.isArray(o.entries) ? o.entries.slice(0, MILEAGE_ENTRIES_MAX) : []) {
    if (!e || typeof e !== "object") continue;
    const x = e as Record<string, unknown>;
    if (typeof x.id !== "string" || x.id === "" || x.id.length > 64) continue;
    if (typeof x.date !== "number" || !Number.isFinite(x.date) || x.date <= 0) continue;
    if (!okNum(x.distance, MILEAGE_DISTANCE_MAX) || !okNum(x.rate, MILEAGE_RATE_MAX)) continue;
    const siteIds = Array.isArray(x.siteIds) ? x.siteIds.filter((i): i is string => typeof i === "string" && i.length <= 64).slice(0, MILEAGE_SITES_MAX) : [];
    entries.push({
      id: x.id, date: x.date, siteIds, distance: x.distance, rate: x.rate,
      ...(okNum(x.calculatedDistance, MILEAGE_DISTANCE_MAX) ? { calculatedDistance: x.calculatedDistance } : {}),
    });
  }
  return { rate: okNum(o.rate, MILEAGE_RATE_MAX) ? o.rate : MILEAGE_RATE_DEFAULT, entries };
}

/** Wpisy danego miesiąca (1–12), od najstarszego. */
export function monthEntries(entries: readonly MileageEntry[], year: number, month: number): MileageEntry[] {
  return entries
    .filter((e) => { const d = new Date(e.date); return d.getFullYear() === year && d.getMonth() + 1 === month; })
    .sort((a, b) => a.date - b.date);
}

export function mileageTotals(entries: readonly MileageEntry[]): { km: number; cost: number } {
  const km = entries.reduce((s, e) => s + e.distance, 0);
  const cost = entries.reduce((s, e) => s + mileageCost(e.distance, e.rate), 0);
  return { km: Math.round(km * 10) / 10, cost: Math.round(cost * 100) / 100 };
}
