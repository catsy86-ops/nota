import type { JournalEntry } from "./yStudy";
import { cleanStages, type SiteStage } from "./stages";
import { cleanOrderLog, cleanShortages, type OrderLogEntry, type Shortage } from "./shortages";
import { SITE_ACCESS_MAX, SITE_PHONE_MAX } from "./contact";
import { cleanSiteHours, type SiteHours } from "./siteHours";
import { cleanSiteDocs, type SiteDoc } from "./siteDocs";
import { cleanServiceCalls, isDayKey, type ServiceCall } from "./service";
import { cleanGeo, type GeoPoint } from "./geo";

/**
 * Karty budów dziennika. Wpis trzyma `siteId` i kopię nazwy (`site`) — starsza wersja
 * aplikacji i tekst raportu dalej ją widzą. Wpisy sprzed kart mają tylko nazwę: ich
 * budowa to `siteKey(nazwa)`, liczone przy odczycie, więc migracja niczego nie
 * przepisuje w dokumencie i dwa telefony nie robią sobie dwóch kart tej samej budowy.
 * Karta trafia do dokumentu dopiero przy zapisie (nowa budowa, edycja karty).
 */

export interface SiteCard {
  id: string;
  name: string;
  address: string;
  investor: string;
  /** Lokalizacja budowy zapisana na miejscu (`geo.ts`) — nowy wpis podpowiada najbliższą budowę. */
  geo?: GeoPoint;
  /** Telefon inwestora (`contact.ts`); brak = nie wpisany. */
  phone?: string;
  /** Kierownik budowy albo osoba na miejscu. */
  manager?: string;
  managerPhone?: string;
  /** Dostęp do budowy: kod do bramy, gdzie klucze, od której wejście. */
  access?: string;
  /** Moment założenia karty (ms). */
  created: number;
  /** Budowa w archiwum od (ms) — znika z pigułek, wpisy zostają. */
  archived?: number;
  /**
   * Ostatnie zamówienie kształtek (ms). Zamówienie liczy kształtki z wpisów nowszych niż ten moment
   * (`order.ts`). Brak = nigdy nie zamawiano, liczy się cała historia budowy.
   */
  orderedAt?: number;
  /** Etapy budowy (`stages.ts`); brak = lista domyślna, jeszcze nieruszana. */
  stages?: SiteStage[];
  /** Braki materiału ze statusem (`shortages.ts`); brak = lista pusta, jeszcze nieruszana. */
  shortages?: Shortage[];
  /** Historia zamówień kształtek, od najstarszego (`shortages.ts`). */
  orders?: OrderLogEntry[];
  /** Godziny pracy na tej budowie, po jednej pozycji na dzień (`siteHours.ts`); brak = nic nie wpisano. */
  hours?: SiteHours[];
  /** Plany i dokumenty budowy (`siteDocs.ts`); brak = nic nie dodano. */
  docs?: SiteDoc[];
  /** Zgłoszenia serwisowe po odbiorze (`service.ts`). */
  service?: ServiceCall[];
  /** Ostatni dzień gwarancji („2028-10-16”); brak = nie wpisano. */
  warranty?: string;
}

export const SITE_NAME_MAX = 120;
export const SITE_FIELD_MAX = 200;

/** Małe litery bez ogonków — „zolta” znajduje „żółta”. */
import { entrySiteId, fold, foldName, siteKey } from "./siteKey";
export { entrySiteId, fold, foldName, siteKey };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Kształt karty; `null` = nie do uratowania. */
const withStages = (stages: SiteStage[] | undefined) => (stages ? { stages } : {});
const optional = <K extends string, V>(k: K, v: V | undefined) => (v === undefined ? {} : ({ [k]: v } as Record<K, V>));

/** Pole tekstowe karty, które nie musi być wpisane: pusty tekst = brak pola. */
const optionalText = <K extends string>(k: K, v: unknown, max: number) => optional(k, str(v, max) || undefined);

const withGeo = (geo: GeoPoint | undefined) => (geo ? { geo } : {});

export function cleanSite(raw: unknown): SiteCard | null {
  const s = raw as Partial<SiteCard> | null;
  if (!s || typeof s !== "object" || typeof s.id !== "string" || !s.id || s.id.length > 64) return null;
  const name = str(s.name, SITE_NAME_MAX);
  if (!name) return null;
  return {
    id: s.id, name,
    address: str(s.address, SITE_FIELD_MAX),
    investor: str(s.investor, SITE_FIELD_MAX),
    ...optionalText("phone", s.phone, SITE_PHONE_MAX),
    ...optionalText("manager", s.manager, SITE_FIELD_MAX),
    ...optionalText("managerPhone", s.managerPhone, SITE_PHONE_MAX),
    ...optionalText("access", s.access, SITE_ACCESS_MAX),
    created: typeof s.created === "number" && Number.isFinite(s.created) ? s.created : 0,
    ...(typeof s.archived === "number" && Number.isFinite(s.archived) ? { archived: s.archived } : {}),
    ...(typeof s.orderedAt === "number" && Number.isFinite(s.orderedAt) ? { orderedAt: s.orderedAt } : {}),
    ...withStages(cleanStages(s.stages)),
    ...optional("shortages", cleanShortages(s.shortages)),
    ...optional("orders", cleanOrderLog(s.orders)),
    ...optional("hours", cleanSiteHours(s.hours)),
    ...optional("docs", cleanSiteDocs(s.docs)),
    ...optional("service", cleanServiceCalls(s.service)),
    ...(isDayKey(s.warranty) ? { warranty: s.warranty } : {}),
    ...withGeo(cleanGeo(s.geo)),
  };
}

export interface SiteInfo extends SiteCard {
  /** Karta zapisana w dokumencie; `false` = budowa tylko z nazw we wpisach. */
  stored: boolean;
  count: number;
  /** Nierozwiązane problemy. */
  open: number;
  /** Pierwszy i ostatni wpis (ms); `null` = bez wpisów. */
  first: number | null;
  last: number | null;
}

/**
 * Wszystkie budowy: karty i nazwy ze starych wpisów, od ostatnio używanej (wpis albo
 * założenie karty). Nazwa budowy bez karty — z najnowszego wpisu.
 */
export function siteDirectory(sites: Readonly<Record<string, SiteCard>>, journal: readonly JournalEntry[]): SiteInfo[] {
  const out = new Map<string, SiteInfo>();
  for (const card of Object.values(sites)) out.set(card.id, { ...card, stored: true, count: 0, open: 0, first: null, last: null });
  for (const e of journal) {
    const id = entrySiteId(e);
    if (!id) continue;
    let info = out.get(id);
    if (!info) out.set(id, (info = { id, name: e.site.trim(), address: "", investor: "", created: e.at, stored: false, count: 0, open: 0, first: null, last: null }));
    else if (!info.stored && (info.last ?? -Infinity) < e.at) info.name = e.site.trim();
    info.count++;
    if (e.kind === "problem" && e.resolved === undefined) info.open++;
    info.first = info.first === null ? e.at : Math.min(info.first, e.at);
    info.last = info.last === null ? e.at : Math.max(info.last, e.at);
  }
  const used = (s: SiteInfo) => Math.max(s.last ?? -Infinity, s.created);
  return [...out.values()].sort((a, b) => used(b) - used(a) || a.name.localeCompare(b.name, "pl"));
}

/** Budowa o tej nazwie (bez ogonków i wielkości liter); czynna przed archiwalną. */
export function findSiteByName(dir: readonly SiteInfo[], name: string): SiteInfo | undefined {
  const key = foldName(name);
  if (!key) return undefined;
  const same = dir.filter((s) => foldName(s.name) === key);
  return same.find((s) => s.archived === undefined) ?? same[0];
}

/**
 * Nazwa z arkusza → budowa wpisu. Nowa nazwa zakłada kartę (`card`); id ze starej nazwy,
 * chyba że zajęła je karta, której nazwę potem zmieniono.
 */
export function resolveSite(
  dir: readonly SiteInfo[],
  name: string,
  now: number,
): { siteId: string | undefined; site: string; card?: SiteCard } {
  const clean = name.trim().slice(0, SITE_NAME_MAX);
  if (!clean) return { siteId: undefined, site: "" };
  const found = findSiteByName(dir, clean);
  if (found) return { siteId: found.id, site: found.name };
  const key = siteKey(clean);
  const id = dir.some((s) => s.id === key) ? `s-${crypto.randomUUID().slice(0, 13)}` : key;
  return { siteId: id, site: clean, card: { id, name: clean, address: "", investor: "", created: now } };
}
