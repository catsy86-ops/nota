/**
 * Wschód i zachód słońca (plan motywów 3.2): harmonogram „wg słońca” dla stylu na noc. Standardowa
 * formuła (deklinacja, równanie czasu, kąt godzinny), dokładność kilka minut — wystarczy na przełączenie
 * stylu. Miasto wybiera użytkownik z listy (T-5: bez geolokalizacji). Liczenie lokalne, bez sieci.
 */

export interface City {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/** Miasta do wyboru (plan motywów T-5). Zaczynamy od największych i miejsc, z których korzysta właściciel. */
export const CITIES: readonly City[] = [
  { id: "warszawa", name: "Warszawa", lat: 52.23, lon: 21.01 },
  { id: "krakow", name: "Kraków", lat: 50.06, lon: 19.94 },
  { id: "lodz", name: "Łódź", lat: 51.76, lon: 19.46 },
  { id: "wroclaw", name: "Wrocław", lat: 51.11, lon: 17.04 },
  { id: "poznan", name: "Poznań", lat: 52.41, lon: 16.93 },
  { id: "gdansk", name: "Gdańsk", lat: 54.35, lon: 18.65 },
  { id: "szczecin", name: "Szczecin", lat: 53.43, lon: 14.55 },
  { id: "lublin", name: "Lublin", lat: 51.25, lon: 22.57 },
  { id: "bialystok", name: "Białystok", lat: 53.13, lon: 23.16 },
  { id: "katowice", name: "Katowice", lat: 50.26, lon: 19.02 },
];

export const DEFAULT_CITY = "warszawa";
export const cityById = (id: string): City => CITIES.find((c) => c.id === id) ?? CITIES[0]!;

const RAD = Math.PI / 180;
/** Wysokość środka słońca przy wschodzie/zachodzie z refrakcją: −0,833°. */
const ZENITH = 90.833 * RAD;

/**
 * Wschód i zachód dla dnia kalendarzowego `date` (wg czasu lokalnego) w danym miejscu. Zwraca `null`,
 * gdy słońce nie wschodzi ani nie zachodzi (polarny dzień/noc — w Polsce się nie zdarza).
 */
export function sunTimes(lat: number, lon: number, date: Date): { rise: Date; set: Date } | null {
  const start = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfYear = Math.floor((start - Date.UTC(date.getFullYear(), 0, 1)) / 86400000) + 1;
  const g = (2 * Math.PI / 365) * (dayOfYear - 1 + 0.5 - 12 / 24);
  // Deklinacja słońca (radiany) i równanie czasu (minuty).
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  // Południe słoneczne w minutach czasu UTC od północy.
  const noon = 720 - 4 * lon - eot;
  const phi = lat * RAD;
  const cosH = (Math.cos(ZENITH) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
  if (cosH < -1 || cosH > 1) return null;
  const halfDay = Math.acos(cosH) / RAD * 4; // kąt godzinny w stopniach × 4 min/°
  return {
    rise: new Date(start + (noon - halfDay) * 60000),
    set: new Date(start + (noon + halfDay) * 60000),
  };
}

/** Czy o `now` jest noc w tym mieście: po zachodzie albo przed wschodem (dnia kalendarzowego). */
export function isNightAt(now: Date, city: City): boolean {
  const t = sunTimes(city.lat, city.lon, now);
  if (!t) return false;
  return now.getTime() >= t.set.getTime() || now.getTime() < t.rise.getTime();
}
