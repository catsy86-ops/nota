import type { JournalEntry } from "./yStudy";
import type { SiteCard } from "./sites";
import { entrySiteId } from "./siteKey";
import { openShortages } from "./shortages";
import { stageProgress } from "./stages";
import { dueServiceCalls } from "./service";

/**
 * Lista przed wejściem na budowę: stałe punkty (BHP, narzędzia, materiał) — wspólne dla wszystkich
 * budów, do zmiany przez użytkownika — oraz punkty „na tej budowie” liczone z karty: kod do bramy,
 * braki, dostawa na dziś, następny etap, otwarte problemy, serwis. Odhaczenia zapisuje się per
 * budowa i dzień; „Wchodzę” zapisuje godzinę wejścia. Czysta logika — zapis w `yEntryCheck.ts`.
 */

export interface CheckItem {
  /** Stałe id punktu: domyślne czytelne, własne `k-…`, z karty budowy `ctx-…`. */
  id: string;
  text: string;
}

export interface CheckRecord {
  /** Id budowy (`SiteCard.id` albo `siteKey(nazwa)`). */
  site: string;
  /** Dzień „2026-10-22” (czas lokalny). */
  day: string;
  /** Id odhaczonych punktów — także punktów z karty. */
  done: string[];
  /** Wejście na budowę (ms) — „Wchodzę”; brak = lista jeszcze otwarta. */
  at?: number;
}

export const CHECK_ITEM_MAX = 80;
export const CHECK_ITEMS_MAX = 20;
/** Ile dni wstecz trzymamy odhaczenia — starsze wypadają przy zapisie nowego dnia. */
export const CHECK_KEEP_DAYS = 120;

/** Typowy poranek instalatora wod-kan: najpierw ochrona, potem sprzęt i materiał, na końcu miejsce pracy. */
export const DEFAULT_CHECK_ITEMS: readonly CheckItem[] = [
  { id: "ochrona", text: "Kask, buty z noskiem, kamizelka" },
  { id: "rece", text: "Rękawice i okulary" },
  { id: "narzedzia", text: "Narzędzia i naładowane akumulatory" },
  { id: "material", text: "Materiał na dziś w aucie" },
  { id: "kierownik", text: "Zgłoszenie u kierownika budowy" },
  { id: "zawor", text: "Wiem, gdzie jest główny zawór wody" },
  { id: "miejsce", text: "Przejścia, otwory i rusztowania bezpieczne" },
  { id: "apteczka", text: "Apteczka i gaśnica na miejscu" },
];

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const SEP = "\u0001";

export const recordKey = (site: string, day: string) => ["r", site, day].join(SEP);
export const isRecordKey = (key: string) => key.startsWith(`r${SEP}`);

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Lista punktów z dokumentu albo kopii; `undefined` = nie lista (zostaje domyślna). */
export function cleanCheckItems(raw: unknown): CheckItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: CheckItem[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    const item = v as Partial<CheckItem> | null;
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id || item.id.length > 40) continue;
    if (seen.has(item.id) || item.id.startsWith("ctx-")) continue;
    const t = text(item.text, CHECK_ITEM_MAX);
    if (!t) continue;
    seen.add(item.id);
    out.push({ id: item.id, text: t });
    if (out.length >= CHECK_ITEMS_MAX) break;
  }
  return out;
}

export function cleanRecord(raw: unknown): CheckRecord | null {
  const r = raw as Partial<CheckRecord> | null;
  if (!r || typeof r !== "object" || typeof r.site !== "string" || !r.site || r.site.length > 64) return null;
  if (typeof r.day !== "string" || !DAY_RE.test(r.day)) return null;
  const done = Array.isArray(r.done)
    ? [...new Set(r.done.filter((x): x is string => typeof x === "string" && !!x && x.length <= 40))].slice(0, CHECK_ITEMS_MAX + 10)
    : [];
  return { site: r.site, day: r.day, done, ...(typeof r.at === "number" && Number.isFinite(r.at) ? { at: r.at } : {}) };
}

const listLine = (names: readonly string[], max = 3) =>
  names.slice(0, max).join(", ") + (names.length > max ? ` i ${names.length - max} więcej` : "");

/**
 * Punkty z karty budowy na dziś. Id są stałe dla rodzaju punktu (np. `ctx-braki`), więc odhaczenie
 * zostaje, gdy w ciągu dnia zmieni się treść (dojdzie brak). Etap tylko z zapisanej listy etapów —
 * budowa bez niej dostałaby „Kanalizację podposadzkową” z listy domyślnej, co rzadko jest prawdą.
 */
export function siteContextItems(
  site: Pick<SiteCard, "id" | "access" | "stages" | "shortages" | "service">,
  journal: readonly JournalEntry[],
  today: string,
  /** Koniec dzisiejszego dnia (ms) — dostawa zaplanowana do tej chwili jest „na dziś”. */
  todayEnd: number,
): CheckItem[] {
  const out: CheckItem[] = [];
  const add = (id: string, t: string) => out.push({ id, text: t.slice(0, 160) });
  if (site.access) add("ctx-dostep", `Dostęp: ${site.access}`);
  const open = openShortages(site.shortages ?? []);
  const missing = open.filter((s) => s.status === "missing").map((s) => s.text);
  if (missing.length) add("ctx-braki", `Brakuje: ${listLine(missing)} — weź albo zamów`);
  const delivery = open.filter((s) => s.status === "ordered" && s.due !== undefined && s.due <= todayEnd).map((s) => s.text);
  if (delivery.length) add("ctx-dostawa", `Dostawa na dziś: ${listLine(delivery)} — odbierz i sprawdź`);
  if (site.stages) {
    const next = stageProgress(site.stages).next;
    if (next) add("ctx-etap", `Dziś w planie: ${next.name}`);
  }
  const problems = journal.filter((e) => e.kind === "problem" && e.resolved === undefined && entrySiteId(e) === site.id);
  if (problems.length) {
    const newest = problems.reduce((a, b) => (b.at > a.at ? b : a));
    const first = newest.text.trim().split("\n")[0].slice(0, 60);
    add("ctx-problemy", problems.length === 1 ? `Otwarty problem: ${first || "bez opisu"}` : `Otwarte problemy: ${problems.length} — najnowszy: ${first || "bez opisu"}`);
  }
  const calls = dueServiceCalls(site.service ?? [], today);
  if (calls.length) add("ctx-serwis", `Serwis: ${listLine(calls.map((c) => c.text.slice(0, 50)), 2)}`);
  return out;
}

export interface CheckStatus {
  done: number;
  total: number;
  /** Wejście zapisane („Wchodzę”). */
  entered: boolean;
  at?: number;
}

/** Postęp: liczą się tylko punkty, które są dziś na liście (odhaczenie usuniętego punktu nie zawyża). */
export function checkStatus(items: readonly CheckItem[], record: CheckRecord | undefined): CheckStatus {
  const done = new Set(record?.done ?? []);
  return {
    done: items.filter((i) => done.has(i.id)).length,
    total: items.length,
    entered: record?.at !== undefined,
    ...(record?.at !== undefined ? { at: record.at } : {}),
  };
}

export function toggleCheck(record: CheckRecord | undefined, site: string, day: string, itemId: string): CheckRecord {
  const done = new Set(record?.done ?? []);
  if (done.has(itemId)) done.delete(itemId); else done.add(itemId);
  return { site, day, done: [...done], ...(record?.at !== undefined ? { at: record.at } : {}) };
}

export function enterSite(record: CheckRecord | undefined, site: string, day: string, at: number): CheckRecord {
  return { site, day, done: [...(record?.done ?? [])], at };
}

/** Cofnięcie wejścia: odhaczenia zostają, lista znów otwarta. */
export function reopenCheck(record: CheckRecord): CheckRecord {
  return { site: record.site, day: record.day, done: [...record.done] };
}

/** Nowy punkt na końcu listy; pusty tekst albo pełna lista — bez zmian. */
export function addCheckItem(items: readonly CheckItem[], t: string, makeId: () => string = () => `k-${crypto.randomUUID().slice(0, 8)}`): CheckItem[] {
  const clean = text(t, CHECK_ITEM_MAX);
  if (!clean || items.length >= CHECK_ITEMS_MAX) return items.map((i) => ({ ...i }));
  return [...items.map((i) => ({ ...i })), { id: makeId(), text: clean }];
}

/** Dzień, przed którym odhaczenia można już wyrzucić. */
export function keepFrom(today: string, days = CHECK_KEEP_DAYS): string {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(y, m - 1, d - days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

const hhmm = (at: number) => new Date(at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });

/** Linia do raportu dnia: „Lista przed wejściem: 8/8, wejście 07:12”. */
export function checkLine(status: CheckStatus): string {
  const base = `Lista przed wejściem: ${status.done}/${status.total}`;
  return status.at !== undefined ? `${base}, wejście ${hhmm(status.at)}` : base;
}
