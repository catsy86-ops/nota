import { pluralPl } from "@/lib/plural";
import type { JournalEntry, JournalKind } from "./yStudy";
import { entrySiteId, fold } from "./sites";
import { fittingsLine } from "./fittings";
import { pipesLine } from "./pipes";
import { testLine } from "./pressureTest";

export const KIND_LABEL: Record<JournalKind, string> = { ok: "Zrobione", problem: "Problem", note: "Notatka" };

/** Rok tylko wtedy, gdy inny niż bieżący — inaczej wpisy sprzed roku zlewały się z dzisiejszymi. */
export function dayLabel(at: number, now: number = Date.now()): string {
  const d = new Date(at);
  const otherYear = d.getFullYear() !== new Date(now).getFullYear();
  return d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", ...(otherYear ? { year: "numeric" } : {}) });
}

/**
 * Nagłówek wpisu: tekst, a bez tekstu — to, co wpis zawiera (próba, kształtki, lista, nagranie, zdjęcie).
 * Wspólny dla osi dziennika, okna raportu i tekstu raportu (WhatsApp, wydruk).
 */
export function entryHeadline(e: Pick<JournalEntry, "text" | "test" | "fittings" | "pipes" | "checked" | "recordings" | "images">): string {
  const text = e.text.trim();
  if (text) return text;
  if (e.test) return "Próba szczelności";
  if (e.fittings?.length) return "Kształtki";
  if (e.pipes?.length) return "Rury";
  if (e.checked.length) return "Sprawdzone punkty listy";
  if (e.recordings?.length) return "Nagranie";
  if (e.images.length) return "Zdjęcie";
  return "Wpis";
}

export const entriesPl = (n: number) => `${n} ${pluralPl(n, ["wpis", "wpisy", "wpisów"])}`;
export const problemsPl = (n: number) => `${n} ${pluralPl(n, ["problem", "problemy", "problemów"])}`;

const pad = (n: number) => String(n).padStart(2, "0");

/** Moment → wartość `<input type="datetime-local">` w czasie lokalnym („2026-10-14T16:30”). */
export function toLocalInput(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Wartość `datetime-local` → moment; pusta albo niepoprawna → `null`. */
export function fromLocalInput(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const at = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
  return Number.isFinite(at) ? at : null;
}

/** Krótko, kiedy był wpis: „dziś, 14:30”, „wczoraj, 9:05”, „pon., 12 paź, 7:40”. */
export function whenLabel(at: number, now: number = Date.now()): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date(now)) - day(d)) / 86_400_000);
  if (diff === 0) return `dziś, ${time}`;
  if (diff === 1) return `wczoraj, ${time}`;
  const otherYear = d.getFullYear() !== new Date(now).getFullYear();
  const date = d.toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "short", ...(otherYear ? { year: "numeric" } : {}) });
  return `${date}, ${time}`;
}

/** „open” = tylko nierozwiązane problemy (z licznika w nagłówku). */
export type KindFilter = JournalKind | "open";

export interface JournalFilter {
  kind: KindFilter | null;
  /** Id budowy (`entrySiteId`); `""` = wpisy bez budowy. */
  site: string | null;
  topic: string | null;
  query: string;
}

export const NO_FILTER: JournalFilter = { kind: null, site: null, topic: null, query: "" };

export const isFiltered = (f: JournalFilter) => f.kind !== null || f.site !== null || f.topic !== null || f.query.trim() !== "";

/**
 * Wpisy pasujące do filtra. Szukanie bez ogonków i wielkości liter, każde słowo musi się znaleźć
 * w tekście, rozwiązaniu problemu, budowie, nazwie tematu albo rodzaju wpisu.
 */
export function filterJournal<E extends JournalEntry>(
  entries: readonly E[],
  f: JournalFilter,
  topicTitle: (id: string) => string | null = () => null,
): E[] {
  const words = fold(f.query).split(/\s+/).filter(Boolean);
  return entries.filter((e) => {
    if (f.kind === "open" ? e.kind !== "problem" || e.resolved !== undefined : f.kind !== null && e.kind !== f.kind) return false;
    if (f.site !== null && entrySiteId(e) !== f.site) return false;
    if (f.topic !== null && e.topic !== f.topic) return false;
    if (words.length === 0) return true;
    // Kształtki i próba szczelności też są w wyszukiwaniu (§9 D1): „kolano”, „9 bar” znajdą wpis.
    const hay = fold([
      e.text, e.solution ?? "", e.site, e.topic ? topicTitle(e.topic) ?? "" : "", KIND_LABEL[e.kind],
      e.fittings?.length ? fittingsLine(e.fittings) : "", e.pipes?.length ? pipesLine(e.pipes) : "", e.test ? testLine(e.test) : "",
    ].join(" "));
    return words.every((w) => hay.includes(w));
  });
}

export const SITE_SUGGESTIONS = 6;

/**
 * Pigułki budów w arkuszu: ostatnio używane, bez bieżącej; przy wpisywaniu tylko pasujące
 * (bez ogonków, każde słowo gdziekolwiek w nazwie).
 */
export function suggestSites(sites: readonly string[], query: string, current: string, limit = SITE_SUGGESTIONS): string[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const cur = current.trim();
  return sites
    .filter((s) => s !== cur && words.every((w) => fold(s).includes(w)))
    .slice(0, limit);
}

export interface JournalSiteGroup<E extends JournalEntry = JournalEntry> {
  /** Id budowy; `""` = bez budowy. */
  siteId: string;
  /** Nazwa budowy z wpisu. */
  site: string;
  entries: E[];
}

export interface JournalDay<E extends JournalEntry = JournalEntry> {
  /** Dzień lokalny „2026-10-14”. */
  key: string;
  label: string;
  count: number;
  sites: JournalSiteGroup<E>[];
}

const dayKey = (at: number) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Oś czasu: dni od najnowszego, w dniu budowy w kolejności ostatniego wpisu, w budowie wpisy od
 * najnowszego. Kolejność wejścia nie ma znaczenia.
 */
export function groupJournal<E extends JournalEntry>(entries: readonly E[], now: number = Date.now()): JournalDay<E>[] {
  const sorted = [...entries].sort((a, b) => b.at - a.at);
  const days: JournalDay<E>[] = [];
  for (const e of sorted) {
    const key = dayKey(e.at);
    let day = days[days.length - 1];
    if (!day || day.key !== key) days.push((day = { key, label: dayLabel(e.at, now), count: 0, sites: [] }));
    day.count++;
    const siteId = entrySiteId(e);
    const group = day.sites.find((g) => g.siteId === siteId);
    if (group) group.entries.push(e); else day.sites.push({ siteId, site: e.site.trim(), entries: [e] });
  }
  return days;
}

export const RECENT_DAYS = 30;

/** Porcja „Pokaż starsze”: tyle starszych wpisów dochodzi na oś za jednym kliknięciem. */
export const OLDER_STEP = 50;

/**
 * Wpisy z ostatnich `RECENT_DAYS` dni (od północy) i liczba starszych — reszta za „Pokaż starsze”.
 * `extra` = ile najnowszych spośród starszych dołożyć (porcje po `OLDER_STEP`), w górę do pełnego dnia,
 * żeby dzień na osi nie urwał się w połowie, a licznik w nagłówku dnia się zgadzał.
 */
export function splitRecent<E extends JournalEntry>(entries: readonly E[], now: number = Date.now(), extra = 0): { recent: E[]; older: number } {
  const d = new Date(now);
  const since = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (RECENT_DAYS - 1)).getTime();
  const recent = entries.filter((e) => e.at >= since);
  if (extra <= 0) return { recent, older: entries.length - recent.length };
  const older = entries.filter((e) => e.at < since).sort((a, b) => b.at - a.at);
  let n = Math.min(extra, older.length);
  while (n > 0 && n < older.length && dayKey(older[n].at) === dayKey(older[n - 1].at)) n++;
  return { recent: [...recent, ...older.slice(0, n)], older: older.length - n };
}

/**
 * Ostatnie różne teksty z tej budowy, od najnowszego — pigułki pod pustym polem „Co się dzieje?”.
 * `siteId` = id karty (`siteDirectory`); pusty = bez budowy, bez podpowiedzi.
 */
export function recentSiteTexts(journal: readonly JournalEntry[], siteId: string, limit = 3): string[] {
  if (!siteId) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of [...journal].sort((a, b) => b.at - a.at)) {
    const text = e.text.trim();
    if (!text || entrySiteId(e) !== siteId || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length === limit) break;
  }
  return out;
}

/** Najnowszy tekst z poprzedniego dnia kalendarzowego na tej budowie („Jak wczoraj”); brak → `null`. */
export function yesterdaySiteText(journal: readonly JournalEntry[], siteId: string, now: number = Date.now()): string | null {
  if (!siteId) return null;
  const today = new Date(now);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).getTime();
  let best: JournalEntry | null = null;
  for (const e of journal) {
    if (e.at < yesterday || e.at >= start || !e.text.trim() || entrySiteId(e) !== siteId) continue;
    if (!best || e.at > best.at) best = e;
  }
  return best?.text.trim() ?? null;
}

/**
 * Ten sam wpis po treści. Każda zmiana dokumentu buduje wpisy od nowa (`getStudy`), więc porównanie
 * referencji przerysowałoby całą oś; wpis jest mały, a klucze idą zawsze w tej samej kolejności (`cleanEntry`).
 */
export function sameJournalEntry(a: JournalEntry, b: JournalEntry): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Budowa nowego wpisu z kontekstu dziennika: filtr budowy (`JournalFilter.site`) → nazwa do arkusza.
 * `null` = brak kontekstu (wszystkie budowy albo nieznane id), arkusz zostaje przy bieżącej budowie;
 * `""` = filtr „Bez budowy”, wpis bez budowy.
 */
export function contextSiteName(siteId: string | null, dir: readonly { id: string; name: string }[]): string | null {
  if (siteId === null) return null;
  if (siteId === "") return "";
  return dir.find((x) => x.id === siteId)?.name ?? null;
}
