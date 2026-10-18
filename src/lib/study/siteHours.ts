import { entrySiteId } from "./siteKey";
import type { JournalEntry } from "./yStudy";

/**
 * Godziny na budowach (H2): ile z dnia pracy w Grafiku przypada na każdą budowę. Pozycja listy karty
 * budowy (`SiteCard.hours`, w mapie `studySiteItems` jako rodzaj `hours`) — jedna na dzień, id = dzień.
 *
 * Zasada, gdy nikt nic nie wpisał:
 * - wpisany podział wygrywa;
 * - jedyna budowa dnia (z wpisami) dostaje cały dzień z Grafiku;
 * - jedyna budowa bez wpisanych godzin przy innych wpisanych — resztę dnia;
 * - kilka budów bez podziału — „nierozdzielone” (`null`), raport nie liczy wtedy pełnego dnia każdej z nich.
 * Czysta logika — zapis w `store.ts` (`setDayHours`), okno w `DayHoursDialog.tsx`.
 */

export interface SiteHours {
  /** Dzień „2026-10-14” — jedna pozycja na dzień i budowę. */
  id: string;
  minutes: number;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const DAY_MAX_MINUTES = 24 * 60;

export function cleanSiteHours(raw: unknown): SiteHours[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const out: SiteHours[] = [];
  for (const h of raw as Partial<SiteHours>[]) {
    if (!h || typeof h.id !== "string" || !DAY_RE.test(h.id) || seen.has(h.id)) continue;
    if (typeof h.minutes !== "number" || !Number.isFinite(h.minutes)) continue;
    const minutes = Math.round(h.minutes);
    if (minutes <= 0 || minutes > DAY_MAX_MINUTES) continue;
    seen.add(h.id);
    out.push({ id: h.id, minutes });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * Godziny z pola: „6”, „6,5”, „6.5”, „6:30”, „6 h 30”; pusty = `0` (bez godzin). Błędne — `null`.
 * Wynik w minutach, zaokrąglony do 5 min.
 */
export function parseHours(raw: string): number | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return 0;
  let min: number;
  const hm = /^(\d{1,2})\s*(?::|h)\s*(\d{1,2})?\s*(?:min)?$/.exec(t);
  // Minuty to 0–59: „6:70” nie jest 7 h 10 min, tylko błędem wpisu.
  if (hm) { if (hm[2] !== undefined && Number(hm[2]) > 59) return null; min = Number(hm[1]) * 60 + Number(hm[2] ?? 0); }
  else if (/^\d{1,2}([.,]\d+)?\s*h?$/.test(t)) min = Number(t.replace(/\s*h$/, "").replace(",", ".")) * 60;
  else return null;
  if (!Number.isFinite(min) || min < 0 || min > DAY_MAX_MINUTES) return null;
  return Math.round(min / 5) * 5;
}

export interface DaySiteHours {
  siteId: string;
  site: string;
  /** Minuty tej budowy; `null` = nierozdzielone (kilka budów bez podziału). */
  minutes: number | null;
  /** Wpisane ręcznie (a nie wyliczone z zasady). */
  set: boolean;
}

export interface DayHours {
  key: string;
  /** Czas pracy z Grafiku (0 = brak zmiany albo nieobecność). */
  work: number;
  sites: DaySiteHours[];
  /** Część dnia bez budowy: praca minus wpisane i wyliczone godziny (może być ujemna — wpisano więcej). */
  rest: number;
}

type HoursCards = Readonly<Record<string, { name?: string; hours?: readonly SiteHours[] }>>;

/**
 * Podział dnia `key`: budowy z wpisami tego dnia i budowy z wpisanymi godzinami. `work` — czas pracy
 * z Grafiku (`workOn` w `report.ts`), `dayKeyOf` — dzień wpisu (podane z zewnątrz, bez cyklu importów).
 */
export function dayHours(journal: readonly JournalEntry[], cards: HoursCards, work: number, key: string, dayKeyOf: (at: number) => string): DayHours {
  const names = new Map<string, string>();
  for (const e of journal) {
    const id = entrySiteId(e);
    if (id && dayKeyOf(e.at) === key && !names.has(id)) names.set(id, cards[id]?.name ?? e.site.trim());
  }
  const set = new Map<string, number>();
  for (const [id, card] of Object.entries(cards)) {
    const h = card.hours?.find((x) => x.id === key);
    if (h) {
      set.set(id, h.minutes);
      if (!names.has(id)) names.set(id, card.name ?? id);
    }
  }
  const unset = [...names.keys()].filter((id) => !set.has(id));
  const setSum = [...set.values()].reduce((s, m) => s + m, 0);
  const sites: DaySiteHours[] = [...names].map(([siteId, site]) => {
    if (set.has(siteId)) return { siteId, site, minutes: set.get(siteId)!, set: true };
    return { siteId, site, minutes: unset.length === 1 ? Math.max(0, work - setSum) : null, set: false };
  });
  const assigned = sites.reduce((s, x) => s + (x.minutes ?? 0), 0);
  return { key, work, sites, rest: unset.length > 1 ? 0 : work - assigned };
}

/** Minuty budowy w dniu albo `null` — nierozdzielone; budowy nie ma tego dnia — `0`. */
export function siteMinutesOn(day: DayHours, siteId: string): number | null {
  const s = day.sites.find((x) => x.siteId === siteId);
  return s ? s.minutes : 0;
}
