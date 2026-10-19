import * as Y from "yjs";
import { cleanFittings, type Fitting } from "./fittings";
import { isImageRef } from "@/lib/imageStore";
import { addDaysToKey } from "@/lib/week";
import { cleanSite, foldName, type SiteCard } from "./sites";
import { cleanCard, reviewCard, type ReviewCard } from "./srs";
import { cleanBoss, cleanGroup, type Boss, type WaGroup } from "./boss";
import { cleanTest, type PressureTest } from "./pressureTest";
import { cleanGeo, type GeoPoint } from "./geo";
import { cleanCustomList, type CustomEntry } from "./custom";
import {
  composeSiteLists, itemKey, LIST_FIELD, listItemId, listItemValue, metaKey, sameItem, SITE_LIST_KINDS, stripLists,
  type SiteListKind, type StageItem,
} from "./siteItems";

/**
 * Dane Nauki w Y.Doc notatek — synchronizują się i trafiają do pliku sync razem
 * z nimi. Moduł nie importuje materiału (`content.ts`): jest w głównej paczce
 * (odśmiecanie zdjęć, kopia zapasowa), a materiał ładuje się dopiero na /nauka.
 * Przynależność do materiału (znane tematy, pytania, punkty) sprawdza `store.ts`.
 *
 * Każdy wpis, temat, punkt i dzień to osobny klucz mapy: dwa telefony
 * dopisujące wpisy albo przesuwające różne tematy scalają się bez strat.
 * Licznik rund jest per urządzenie (suma), bo `rounds + 1` z dwóch telefonów
 * dałby po scaleniu jedną rundę zamiast dwóch. Seria liczy się z dni z rundą.
 */

export type Column = "todo" | "doing" | "done";
export const COLUMNS: Column[] = ["todo", "doing", "done"];

/** Rodzaj wpisu w dzienniku z budowy. */
export type JournalKind = "ok" | "problem" | "note";
export const JOURNAL_KINDS: JournalKind[] = ["ok", "problem", "note"];

export interface JournalEntry {
  id: string;
  /** Moment wpisu (ms). */
  at: number;
  kind: JournalKind;
  /** Temat z materiału, którego dotyczy wpis; `null` = ogólny. */
  topic: string | null;
  text: string;
  /** Nazwa budowy w chwili wpisu (kopia z karty — starsze wersje aplikacji widzą tylko ją). */
  site: string;
  /** Karta budowy (`studySites`); brak = wpis sprzed kart, budowa z nazwy (`entrySiteId`). */
  siteId?: string;
  /** Punkty listy do nauki potwierdzone na budowie (id z `CHECKLIST`). */
  checked: string[];
  /** Zdjęcia z budowy: klucze z `imageStore` (bajty poza stanem Nauki). */
  images: string[];
  /** Problem rozwiązany — moment rozwiązania (ms); brak = otwarty. Tylko dla `problem`. */
  resolved?: number;
  /** Jak problem rozwiązano („wymieniona złączka”) — baza własnych rozwiązań. Tylko dla `problem`. */
  solution?: string;
  /** Protokół próby szczelności (`pressureTest.ts`); brak = wpis bez próby. */
  test?: PressureTest;
  /** Zużyte kształtki (`fittings.ts`); brak = bez kształtek. */
  fittings?: Fitting[];
  /** Etap budowy (id z listy karty, `stages.ts`), który ten wpis zamknął — zdjęcia idą do protokołu przy etapie. */
  stage?: string;
  /** „Tu jestem”: gdzie zapisano wpis (`geo.ts`); tylko po stuknięciu, nie trafia do raportu. */
  geo?: GeoPoint;
}

/**
 * Ile zdjęć mieści jeden wpis (decyzja 2026-10-15: 5 — seria „przed zakryciem”).
 * Starsza wersja aplikacji (limit 4) pokaże 4, a przy edycji wpisu piąte zgubi.
 */
export const JOURNAL_MAX_IMAGES = 5;
export const JOURNAL_MAX_TEXT = 2000;
/** Opis rozwiązania problemu — krótki, jedno-dwa zdania. */
export const JOURNAL_SOLUTION_MAX = 500;
export const SITE_MAX = 120;

export interface StudyState {
  /** Kolumna tablicy per temat; brak wpisu = „Do nauki”. */
  board: Record<string, Column>;
  /** Odhaczone punkty listy do nauki. */
  checked: Record<string, true>;
  /** Najlepszy wynik quizu w procentach (0–100) albo `null`. */
  bestPercent: number | null;
  rounds: number;
  /** Pytania, na które ostatnio odpowiedziano błędnie — materiał do „Powtórki błędów”. */
  missed: Record<string, true>;
  /** Dziennik z budowy, od najstarszego do najnowszego. */
  journal: JournalEntry[];
  /** Bieżąca inwestycja — podpowiada się przy kolejnych wpisach. */
  site: string;
  /** Karty budów po id. */
  sites: Record<string, SiteCard>;
  /** Seria kolejnych dni z co najmniej jedną rundą quizu (stan na `lastDay`). */
  streak: number;
  /** Dzień ostatniej rundy („2026-10-12”) albo `null`. */
  lastDay: string | null;
  /** Powtórki pytań (SM-2 lite, `srs.ts`) po id pytania. */
  review: Record<string, ReviewCard>;
  /** Szef, któremu idzie raport (WhatsApp); `null` = nieustawiony. */
  boss: Boss | null;
  /** Grupa WhatsApp na raporty; `null` = nieustawiona. */
  group: WaGroup | null;
  /** Dni z co najmniej jedną rundą quizu, rosnąco (statystyki). */
  days: string[];
  /** Własne pytania i punkty listy (`custom.ts`), od najstarszego. */
  custom: CustomEntry[];
}

/** Rundy i najlepszy wynik jednego urządzenia. */
export interface DeviceRounds {
  rounds: number;
  best: number | null;
}

/** Cała Nauka jako zwykły obiekt — sekcja `study` pełnej kopii. */
export interface StudyDump {
  version: 1;
  board: Record<string, Column>;
  checked: Record<string, true>;
  missed: Record<string, true>;
  journal: JournalEntry[];
  /** Dni z co najmniej jedną rundą quizu. */
  days: string[];
  rounds: Record<string, DeviceRounds>;
  site: string;
  sites: Record<string, SiteCard>;
  /** Powtórki pytań; brak w kopiach sprzed N3. */
  review: Record<string, ReviewCard>;
  boss: Boss | null;
  group: WaGroup | null;
  /** Własne pytania i punkty listy po id; brak w kopiach sprzed N5. */
  custom: Record<string, CustomEntry>;
}

/** Origin transakcji Nauki — odróżnia lokalne zmiany od tych z sieci i z migracji. */
export const STUDY_ORIGIN = "study";
const MIGRATION_ORIGIN = "study-migration";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isColumn = (v: unknown): v is Column => v === "todo" || v === "doing" || v === "done";
const isPercent = (v: unknown): v is number => typeof v === "number" && v >= 0 && v <= 100;

/**
 * Część wpisu wspólna dla zapisu, kopii i projekcji: tekst, odhaczenia (id, bez sprawdzania
 * materiału), zdjęcia, próba, kształtki, etap, lokalizacja. `empty` = nic w tym nie ma
 * (sprawdzane przed filtrem materiału — wpis z odhaczeniami, których punkt zniknął, zostaje).
 */
export function cleanEntryParts(e: { text?: unknown; checked?: unknown; images?: unknown; test?: unknown; fittings?: unknown; stage?: unknown; geo?: unknown }) {
  const text = typeof e.text === "string" ? e.text.slice(0, JOURNAL_MAX_TEXT) : "";
  const checked = Array.isArray(e.checked) ? e.checked.filter((id): id is string => typeof id === "string" && id.length <= 64).slice(0, 60) : [];
  const images = Array.isArray(e.images) ? e.images.filter((r): r is string => typeof r === "string" && isImageRef(r)).slice(0, JOURNAL_MAX_IMAGES) : [];
  const test = cleanTest(e.test);
  const fittings = cleanFittings(e.fittings);
  const stage = cleanEntryStage(e.stage);
  const geo = cleanGeo(e.geo);
  const empty = !text.trim() && checked.length === 0 && images.length === 0 && !test && fittings.length === 0 && !stage;
  return { text, checked, images, test, fittings, stage, geo, empty };
}

/** Kształt wpisu (bez sprawdzania materiału); `null` = nie do uratowania. */
export function cleanEntry(raw: unknown): JournalEntry | null {
  const e = raw as Partial<JournalEntry> | null;
  if (!e || typeof e !== "object") return null;
  if (typeof e.id !== "string" || !e.id || e.id.length > 64) return null;
  if (typeof e.at !== "number" || !Number.isFinite(e.at)) return null;
  if (!JOURNAL_KINDS.includes(e.kind as JournalKind)) return null;
  const { text, checked, images, test, fittings, stage, geo, empty } = cleanEntryParts(e);
  if (empty) return null;
  return {
    id: e.id, at: e.at, kind: e.kind as JournalKind,
    topic: typeof e.topic === "string" && e.topic.length <= 64 ? e.topic : null,
    text,
    site: typeof e.site === "string" ? e.site.slice(0, SITE_MAX) : "",
    ...(typeof e.siteId === "string" && e.siteId && e.siteId.length <= 64 ? { siteId: e.siteId } : {}),
    checked,
    images,
    ...(e.kind === "problem" && typeof e.resolved === "number" && Number.isFinite(e.resolved) ? { resolved: e.resolved } : {}),
    ...(e.kind === "problem" && typeof e.solution === "string" && e.solution.trim() ? { solution: e.solution.trim().slice(0, JOURNAL_SOLUTION_MAX) } : {}),
    ...(test ? { test } : {}),
    ...(fittings.length ? { fittings } : {}),
    ...(stage ? { stage } : {}),
    ...(geo ? { geo } : {}),
  };
}

/** Id etapu przy wpisie; śmieci → brak. */
export const cleanEntryStage = (v: unknown): string | undefined => (typeof v === "string" && v && v.length <= 40 ? v : undefined);

const trueKeys = (v: unknown): string[] =>
  v && typeof v === "object" ? Object.entries(v as Record<string, unknown>).filter(([, x]) => x === true).map(([k]) => k) : [];

/** Dowolne wejście (plik kopii, peer) → poprawny kształt zrzutu. */
export function cleanDump(raw: unknown): StudyDump {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof StudyDump, unknown>>;
  const board: Record<string, Column> = {};
  if (s.board && typeof s.board === "object") {
    for (const [k, v] of Object.entries(s.board)) if (isColumn(v) && v !== "todo") board[k] = v;
  }
  const rounds: Record<string, DeviceRounds> = {};
  if (s.rounds && typeof s.rounds === "object") {
    for (const [k, v] of Object.entries(s.rounds as Record<string, Partial<DeviceRounds>>)) {
      if (!v || typeof v !== "object" || typeof v.rounds !== "number" || !(v.rounds >= 0)) continue;
      rounds[k] = { rounds: Math.floor(v.rounds), best: isPercent(v.best) ? Math.round(v.best) : null };
    }
  }
  return {
    version: 1,
    board,
    checked: Object.fromEntries(trueKeys(s.checked).map((k) => [k, true as const])),
    missed: Object.fromEntries(trueKeys(s.missed).map((k) => [k, true as const])),
    journal: (Array.isArray(s.journal) ? s.journal : []).map(cleanEntry).filter((e): e is JournalEntry => !!e),
    days: Array.isArray(s.days) ? s.days.filter((d): d is string => typeof d === "string" && DAY_RE.test(d)) : [],
    rounds,
    site: typeof s.site === "string" ? s.site.slice(0, SITE_MAX) : "",
    sites: cleanSites(s.sites),
    review: cleanReviews(s.review),
    boss: cleanBoss(s.boss),
    group: cleanGroup(s.group),
    custom: Object.fromEntries(cleanCustomList(s.custom).map((e) => [e.id, e])),
  };
}

function cleanReviews(raw: unknown): Record<string, ReviewCard> {
  const out: Record<string, ReviewCard> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw)) {
    const card = k.length <= 64 ? cleanCard(v) : null;
    if (card) out[k] = card;
  }
  return out;
}

function cleanSites(raw: unknown): Record<string, SiteCard> {
  const out: Record<string, SiteCard> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw)) {
    const card = cleanSite(v);
    if (card && card.id === k) out[k] = card;
  }
  return out;
}

/**
 * Dawny zapis z localStorage (`kaczy.study.v1`) → zrzut. Seria wraca jako dni
 * (`lastDay` i `streak − 1` dni przed nim), rundy — jako licznik `device`.
 */
export function dumpFromLegacy(raw: unknown, device: string): StudyDump {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<StudyState>;
  const dump = cleanDump({ board: s.board, checked: s.checked, missed: s.missed, journal: s.journal, site: s.site });
  if (typeof s.lastDay === "string" && DAY_RE.test(s.lastDay)) {
    const streak = typeof s.streak === "number" && s.streak >= 1 ? Math.min(Math.floor(s.streak), 3660) : 1;
    for (let i = 0; i < streak; i++) dump.days.push(addDaysToKey(s.lastDay, -i));
  }
  const rounds = typeof s.rounds === "number" && s.rounds >= 0 ? Math.floor(s.rounds) : 0;
  const best = isPercent(s.bestPercent) ? Math.round(s.bestPercent) : null;
  if (rounds > 0 || best !== null) dump.rounds[device] = { rounds, best };
  return dump;
}

/** Zrzut → dawny kształt `StudyState` (projekcja i zapis dla starszych wersji aplikacji). */
export function stateFromDump(d: StudyDump): StudyState {
  const devices = Object.values(d.rounds);
  const bests = devices.map((r) => r.best).filter((b): b is number => b !== null);
  const days = new Set(d.days);
  const lastDay = d.days.length ? d.days.reduce((a, b) => (b > a ? b : a)) : null;
  let streak = 0;
  for (let day = lastDay; day && days.has(day); day = addDaysToKey(day, -1)) streak++;
  return {
    board: d.board,
    checked: d.checked,
    missed: d.missed,
    journal: [...d.journal].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1)),
    site: d.site,
    sites: d.sites,
    rounds: devices.reduce((n, r) => n + r.rounds, 0),
    bestPercent: bests.length ? Math.max(...bests) : null,
    streak,
    lastDay,
    review: d.review,
    boss: d.boss,
    group: d.group,
    days: [...d.days].sort(),
    custom: Object.values(d.custom),
  };
}

/** Klucze zdjęć dziennika w dokumencie — dla odśmiecania i synchronizacji obrazów. */
// Klucze zdjęć dziennika w dokumencie — w osobnym, małym module (rdzeń synchronizacji go używa).
export { journalRefsIn } from "./journalRefs";

export function createYStudy(doc: Y.Doc) {
  const journal = doc.getMap<JournalEntry>("studyJournal");
  const board = doc.getMap<Column>("studyBoard");
  const checked = doc.getMap<true>("studyChecked");
  const missed = doc.getMap<true>("studyMissed");
  const days = doc.getMap<true>("studyDays");
  /** Id urządzenia → jego rundy i najlepszy wynik. */
  const rounds = doc.getMap<DeviceRounds>("studyRounds");
  const meta = doc.getMap<unknown>("studyMeta");
  /** Karty budów (id → karta). */
  const sites = doc.getMap<SiteCard>("studySites");
  /** Urządzenia, których stary zapis jest już w dokumencie (id urządzenia → czas). */
  const migrations = doc.getMap<number>("studyMigrations");
  /** Powtórki: id pytania → karta SM-2. Klucz per pytanie — dwa telefony scalają różne pytania. */
  const review = doc.getMap<ReviewCard>("studyReview");
  /** Własne pytania i punkty listy (`custom.ts`): id → wpis. */
  const custom = doc.getMap<CustomEntry>("studyCustom");
  /** Etapy, braki i historia zamówień budów — pozycja na klucz (`siteItems.ts`). */
  const siteItems = doc.getMap<unknown>("studySiteItems");

  let snapshot: StudyState | null = null;
  const listeners = new Set<() => void>();
  const onChange = () => {
    snapshot = null;
    listeners.forEach((l) => l());
  };
  for (const m of [journal, board, checked, missed, days, rounds, meta, sites, review, custom, siteItems] as Y.Map<unknown>[]) m.observe(onChange);

  /** Dokument jako zwykły obiekt, przez `cleanDump` — śmieci od peera nie wywrócą widoku. */
  function dump(): StudyDump {
    return cleanDump({
      board: Object.fromEntries(board.entries()),
      checked: Object.fromEntries(checked.entries()),
      missed: Object.fromEntries(missed.entries()),
      journal: Array.from(journal.values()),
      days: Array.from(days.keys()),
      rounds: Object.fromEntries(rounds.entries()),
      site: meta.get("site"),
      // Listy z osobnej mapy nadpisują dawne pola karty (te zostają tylko w kartach sprzed migracji).
      sites: withSiteLists(),
      review: Object.fromEntries(review.entries()),
      boss: meta.get("boss"),
      group: meta.get("waGroup"),
      custom: Object.fromEntries(custom.entries()),
    });
  }

  function withSiteLists(): Record<string, SiteCard> {
    const lists = composeSiteLists(siteItems.entries());
    const out: Record<string, SiteCard> = {};
    for (const [k, card] of sites.entries()) out[k] = { ...card, ...(lists.get(k) ?? {}) };
    return out;
  }

  /**
   * Zapisuje pozycje listy jako osobne klucze — bez transakcji (woła ją zapis). Dawne pole karty
   * przechodzi do mapy przy pierwszym zapisie tej listy; potem ze znacznikiem lista jest w mapie.
   */
  function writeListItems(siteId: string, kind: SiteListKind, next: readonly unknown[], base: readonly unknown[]): void {
    const want = new Map(next.map((x) => [listItemId(kind, x), listItemValue(kind, x)] as const));
    const had = new Map(base.map((x) => [listItemId(kind, x), listItemValue(kind, x)] as const));
    for (const id of had.keys()) {
      const k = itemKey(siteId, kind, id);
      if (!want.has(id) && siteItems.has(k)) siteItems.delete(k);
    }
    // Kolejność etapu: zachowana z mapy; nowy etap — na koniec (największa + 1).
    let maxOrder = -1;
    if (kind === "stage") {
      for (const [k, v] of siteItems.entries()) {
        if (k.startsWith(itemKey(siteId, "stage", "")) && typeof (v as StageItem)?.order === "number") maxOrder = Math.max(maxOrder, (v as StageItem).order);
      }
    }
    for (const [id, value] of want) {
      if (had.has(id) && sameItem(kind, had.get(id), value)) continue;
      const k = itemKey(siteId, kind, id);
      if (kind === "stage") {
        const prev = siteItems.get(k) as StageItem | undefined;
        const order = typeof prev?.order === "number" ? prev.order : (maxOrder += 1);
        siteItems.set(k, { ...(value as object), order });
      } else siteItems.set(k, value);
    }
    if (!siteItems.has(metaKey(siteId, kind))) siteItems.set(metaKey(siteId, kind), true);
  }

  /** Dawne listy w polach karty (sprzed `studySiteItems`) → mapa; pola znikają z karty. Bez transakcji. */
  function migrateCardLists(siteId: string, source?: SiteCard): void {
    const stored = sites.get(siteId);
    for (const kind of SITE_LIST_KINDS) {
      if (siteItems.has(metaKey(siteId, kind))) continue;
      const legacy = (stored?.[LIST_FIELD[kind]] ?? source?.[LIST_FIELD[kind]]) as unknown[] | undefined;
      if (legacy && legacy.length > 0) writeListItems(siteId, kind, legacy, []);
      else if (legacy) siteItems.set(metaKey(siteId, kind), true);
    }
    if (stored && SITE_LIST_KINDS.some((k) => stored[LIST_FIELD[k]] !== undefined)) sites.set(siteId, stripLists(stored));
  }

  function get(): StudyState {
    if (!snapshot) snapshot = stateFromDump(dump());
    return snapshot;
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  const transact = (fn: () => void, origin: string = STUDY_ORIGIN) => doc.transact(fn, origin);
  const toggleIn = (m: Y.Map<true>, key: string, on: boolean) => { if (on) { if (!m.has(key)) m.set(key, true); } else if (m.has(key)) m.delete(key); };

  function setColumn(topicId: string, column: Column): void {
    transact(() => {
      if (column === "todo") { if (board.has(topicId)) board.delete(topicId); } else if (board.get(topicId) !== column) board.set(topicId, column);
    });
  }

  function setChecked(itemId: string, on: boolean): void {
    transact(() => toggleIn(checked, itemId, on));
  }

  function clearChecked(): void {
    transact(() => { for (const k of Array.from(checked.keys())) checked.delete(k); });
  }

  /** Odhacza punkty z powrotem jedną transakcją („Cofnij” po wyczyszczeniu). */
  function restoreChecked(ids: string[]): void {
    transact(() => { for (const id of ids) toggleIn(checked, id, true); });
  }

  /**
   * Runda quizu na urządzeniu `device`: licznik i najlepszy wynik tego urządzenia,
   * dzień do serii, zdegradowane tematy, zmiany listy błędów i terminy powtórek —
   * jedną transakcją.
   */
  function recordRound(device: string, percent: number, day: string, demote: string[], results: { id: string; ok: boolean }[]): void {
    transact(() => {
      const prev = rounds.get(device);
      const best = prev?.best ?? null;
      rounds.set(device, { rounds: (prev?.rounds ?? 0) + 1, best: best === null ? percent : Math.max(best, percent) });
      if (DAY_RE.test(day) && !days.has(day)) days.set(day, true);
      for (const id of demote) if (board.get(id) === "done") board.set(id, "doing");
      for (const r of results) toggleIn(missed, r.id, !r.ok);
      if (DAY_RE.test(day)) {
        for (const r of results) {
          const prevCard = cleanCard(review.get(r.id)) ?? undefined;
          const nextCard = reviewCard(prevCard, r.ok, day);
          if (nextCard !== prevCard) review.set(r.id, nextCard);
        }
      }
    });
  }

  /** Dopisuje wpis (z kartą nowej budowy); problem przy temacie z „Umiem” cofa go do „W trakcie”. */
  function addEntry(entry: JournalEntry, newSite?: SiteCard): void {
    transact(() => {
      if (newSite && !sites.has(newSite.id)) sites.set(newSite.id, newSite);
      journal.set(entry.id, entry);
      if (entry.kind === "problem" && entry.topic && board.get(entry.topic) === "done") board.set(entry.topic, "doing");
    });
  }

  /**
   * Zmienia wpis w całości (edycja w arkuszu). Wpis, który stał się problemem albo
   * problem przeniesiony na inny temat, cofa temat z „Umiem” — jak nowy problem.
   */
  function updateEntry(entry: JournalEntry, newSite?: SiteCard): void {
    transact(() => {
      if (newSite && !sites.has(newSite.id)) sites.set(newSite.id, newSite);
      const prev = journal.get(entry.id);
      journal.set(entry.id, entry);
      const newProblem = entry.kind === "problem" && entry.topic && (prev?.kind !== "problem" || prev.topic !== entry.topic);
      if (newProblem && board.get(entry.topic!) === "done") board.set(entry.topic!, "doing");
    });
  }

  /** Problem rozwiązany (`at`) albo z powrotem otwarty (`null`). */
  function setResolved(id: string, at: number | null): void {
    const e = journal.get(id);
    if (!e || e.kind !== "problem") return;
    const { resolved: _, ...rest } = e;
    transact(() => journal.set(id, at === null ? rest : { ...rest, resolved: at }));
  }

  /** Opis rozwiązania problemu; pusty tekst usuwa opis. Inny rodzaj wpisu — nic. */
  function setSolution(id: string, text: string): void {
    const e = journal.get(id);
    if (!e || e.kind !== "problem") return;
    const { solution: _, ...rest } = e;
    const t = text.trim().slice(0, JOURNAL_SOLUTION_MAX);
    transact(() => journal.set(id, t ? { ...rest, solution: t } : rest));
  }

  /** Przywraca usunięty wpis (Cofnij); wpis, który w międzyczasie wrócił, zostaje. */
  function restoreEntry(entry: JournalEntry): void {
    transact(() => { if (!journal.has(entry.id)) journal.set(entry.id, entry); });
  }

  function removeEntry(id: string): JournalEntry | null {
    const found = get().journal.find((e) => e.id === id) ?? null;
    if (found) transact(() => journal.delete(id));
    return found;
  }

  /** Szef do raportów; `null` usuwa kontakt. */
  function setBoss(boss: Boss | null): void {
    transact(() => { if (boss) meta.set("boss", boss); else if (meta.has("boss")) meta.delete("boss"); });
  }

  /** Grupa WhatsApp na raporty; `null` ją usuwa. */
  function setGroup(group: WaGroup | null): void {
    transact(() => { if (group) meta.set("waGroup", group); else if (meta.has("waGroup")) meta.delete("waGroup"); });
  }

  function setSite(site: string): void {
    transact(() => { if (meta.get("site") !== site) meta.set("site", site); });
  }

  /**
   * Zapisuje kartę budowy. Zmiana nazwy przenosi też bieżącą budowę arkusza,
   * jeśli to była ta (`prevName`) — inaczej następny wpis założyłby starą od nowa.
   */
  function saveSite(card: SiteCard, prevName?: string): void {
    transact(() => {
      // Listy karty są w osobnej mapie: tu tylko przeniesienie dawnych pól (stara karta albo kopia), potem sama karta.
      migrateCardLists(card.id, card);
      sites.set(card.id, stripLists(card));
      const cur = meta.get("site");
      if (prevName && typeof cur === "string" && foldName(cur) === foldName(prevName) && cur !== card.name) meta.set("site", card.name);
    });
  }

  /**
   * Zmienia listę karty budowy (etapy, braki, historia zamówień): zapisuje tylko różnicę między
   * `base` (lista, od której zaczął użytkownik) a `next`. Pozycje dopisane w tym czasie na drugim
   * telefonie zostają — usuwamy tylko to, co było w `base`.
   */
  function setSiteList(siteId: string, kind: SiteListKind, next: readonly unknown[], base: readonly unknown[]): void {
    transact(() => {
      migrateCardLists(siteId);
      writeListItems(siteId, kind, next, base);
    });
  }

  /**
   * Dodaje własne pytanie albo punkt. Id nadaje wywołujący (`c-…`), a nowy wpis
   * nie nadpisuje istniejącego o tym samym id.
   */
  function addCustom(entry: CustomEntry): void {
    if (!custom.has(entry.id)) custom.set(entry.id, entry);
  }

  /** Usuwa własny wpis razem z jego powtórkami, błędami i odhaczeniem — nie zostaje po nim śmieć. */
  function removeCustom(id: string): CustomEntry | null {
    const prev = custom.get(id) ?? null;
    if (!prev) return null;
    transact(() => {
      custom.delete(id);
      review.delete(id);
      missed.delete(id);
      checked.delete(id);
    });
    return prev;
  }

  /** Cofnięcie usunięcia: wpis wraca z tym samym id (powtórki już nie wrócą). */
  function restoreCustom(entry: CustomEntry): void {
    custom.set(entry.id, entry);
  }

  /** Cała Nauka naraz (przywrócenie kopii) — zastępuje, nie scala. */
  function replaceAll(data: StudyDump): void {
    const d = cleanDump(data);
    transact(() => {
      for (const m of [journal, board, checked, missed, days, rounds, sites, review, custom, siteItems] as Y.Map<unknown>[]) for (const k of Array.from(m.keys())) m.delete(k);
      for (const e of d.journal) journal.set(e.id, e);
      for (const [k, v] of Object.entries(d.board)) board.set(k, v);
      for (const k of Object.keys(d.checked)) checked.set(k, true);
      for (const k of Object.keys(d.missed)) missed.set(k, true);
      for (const k of d.days) days.set(k, true);
      for (const [k, v] of Object.entries(d.rounds)) rounds.set(k, v);
      // Kopia niesie listy w kartach — do osobnej mapy, karty bez list.
      for (const [k, v] of Object.entries(d.sites)) { migrateCardLists(k, v); sites.set(k, stripLists(v)); }
      for (const [k, v] of Object.entries(d.review)) review.set(k, v);
      for (const [k, v] of Object.entries(d.custom)) custom.set(k, v);
      meta.set("site", d.site);
      if (d.boss) meta.set("boss", d.boss); else meta.delete("boss");
      if (d.group) meta.set("waGroup", d.group); else meta.delete("waGroup");
    });
  }

  /**
   * Dokłada dane z innego źródła (stary zapis w localStorage) bez nadpisywania
   * tego, co już jest w dokumencie — np. wpisów z drugiego telefonu. Wywołana
   * drugi raz z tym samym wejściem niczego nie zmienia. `marker` ląduje w tej
   * samej transakcji co dane: zapisują się na dysk razem albo wcale.
   */
  function mergeIn(data: StudyDump, marker?: string): void {
    const d = cleanDump(data);
    transact(() => {
      if (marker) migrations.set(marker, Date.now());
      for (const e of d.journal) if (!journal.has(e.id)) journal.set(e.id, e);
      for (const [k, v] of Object.entries(d.board)) if (!board.has(k)) board.set(k, v);
      for (const k of Object.keys(d.checked)) if (!checked.has(k)) checked.set(k, true);
      for (const k of Object.keys(d.missed)) if (!missed.has(k)) missed.set(k, true);
      for (const k of d.days) if (!days.has(k)) days.set(k, true);
      for (const [k, v] of Object.entries(d.rounds)) {
        const prev = rounds.get(k);
        if (!prev) { rounds.set(k, v); continue; }
        const best = prev.best === null ? v.best : v.best === null ? prev.best : Math.max(prev.best, v.best);
        if (v.rounds > prev.rounds || best !== prev.best) rounds.set(k, { rounds: Math.max(prev.rounds, v.rounds), best });
      }
      for (const [k, v] of Object.entries(d.sites)) if (!sites.has(k)) { migrateCardLists(k, v); sites.set(k, stripLists(v)); }
      // Karta z nowszą ostatnią odpowiedzią wygrywa.
      for (const [k, v] of Object.entries(d.review)) {
        const prev = cleanCard(review.get(k));
        if (!prev || v.last > prev.last) review.set(k, v);
      }
      for (const [k, v] of Object.entries(d.custom)) if (!custom.has(k)) custom.set(k, v);
      if (!meta.has("site") && d.site) meta.set("site", d.site);
      if (!meta.has("boss") && d.boss) meta.set("boss", d.boss);
      if (!meta.has("waGroup") && d.group) meta.set("waGroup", d.group);
    }, MIGRATION_ORIGIN);
  }

  const isMerged = (marker: string) => migrations.has(marker);

  return {
    get, dump, subscribe, isMerged,
    setColumn, setChecked, clearChecked, restoreChecked, recordRound,
    addEntry, updateEntry, setResolved, setSolution, restoreEntry, removeEntry, setSite, saveSite, setSiteList, setBoss, setGroup,
    addCustom, removeCustom, restoreCustom,
    replaceAll, mergeIn,
  };
}

export type YStudy = ReturnType<typeof createYStudy>;
