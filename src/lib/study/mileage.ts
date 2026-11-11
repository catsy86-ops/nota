/**
 * B4.3: Kilometrówka — trasa dnia z kolejności budów, odległość i stawka za km.
 * Miesięczne zestawienie i CSV dla księgowej.
 */

export interface MileageEntry {
  id: string;
  date: number;              // timestamp
  siteIds: string[];         // kolejność budów w dniu
  distance: number;          // km (ręczny wpis z licznika)
  rate: number;              // stawka za km (zł)
  calculatedDistance?: number; // podpowiedź: km w linii prostej × 1,3
}

export interface MileageMonth {
  year: number;
  month: number;             // 1-12
  entries: MileageEntry[];
}

export const MILEAGE_RATE_DEFAULT = 0.65; // zł/km (domyślna stawka)

export function calculateLinearDistance(
  coords1: [number, number],
  coords2: [number, number]
): number {
  // Przybliżenie w km (Ziemia płaska przy małych dystansach)
  const [lat1, lon1] = coords1;
  const [lat2, lon2] = coords2;
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const km = Math.sqrt(dLat * dLat + dLon * dLon) * 111; // 1° ≈ 111 km
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

export function exportMileageCSV(month: MileageMonth): string {
  const header = "Data,Liczba budów,Dystans (km),Stawka (zł/km),Koszt (zł)\n";
  const rows = month.entries
    .map((e) => {
      const date = new Date(e.date).toISOString().split("T")[0];
      const cost = mileageCost(e.distance, e.rate);
      return `${date},${e.siteIds.length},${e.distance},${e.rate},${cost.toFixed(2)}`;
    })
    .join("\n");

  const total = month.entries.reduce((sum, e) => sum + mileageCost(e.distance, e.rate), 0);
  const km = month.entries.reduce((sum, e) => sum + e.distance, 0);
  // Wiersz sumy ma te same kolumny co dane: tekst tylko w pierwszej, liczby w liczbowych.
  const summary = `\nRazem,,${Math.round(km * 10) / 10},,${total.toFixed(2)}`;

  return header + rows + summary;
}
