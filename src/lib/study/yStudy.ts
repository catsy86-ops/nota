import * as Y from "yjs";
import { isImageRef } from "@/lib/imageStore";
import { addDaysToKey } from "@/lib/week";

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
  /** Inwestycja / adres w chwili wpisu. */
  site: string;
  /** Punkty listy do nauki potwierdzone na budowie (id z `CHECKLIST`). */
  checked: string[];
  /** Zdjęcia z budowy: klucze z `imageStore` (bajty poza stanem Nauki). */
  images: string[];
}

/** Ile zdjęć mieści jeden wpis. */
export const JOURNAL_MAX_IMAGES = 4;
export const JOURNAL_MAX_TEXT = 2000;
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
  /** Seria kolejnych dni z co najmniej jedną rundą quizu (stan na `lastDay`). */
  streak: number;
  /** Dzień ostatniej rundy („2026-10-12”) albo `null`. */
  lastDay: string | null;
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
}

/** Origin transakcji Nauki — odróżnia lokalne zmiany od tych z sieci i z migracji. */
export const STUDY_ORIGIN = "study";
const MIGRATION_ORIGIN = "study-migration";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isColumn = (v: unknown): v is Column => v === "todo" || v === "doing" || v === "done";
const isPercent = (v: unknown): v is number => typeof v === "number" && v >= 0 && v <= 100;

/** Kształt wpisu (bez sprawdzania materiału); `null` = nie do uratowania. */
export function cleanEntry(raw: unknown): JournalEntry | null {
  const e = raw as Partial<JournalEntry> | null;
  if (!e || typeof e !== "object") return null;
  if (typeof e.id !== "string" || !e.id || e.id.length > 64) return null;
  if (typeof e.at !== "number" || !Number.isFinite(e.at)) return null;
  if (!JOURNAL_KINDS.includes(e.kind as JournalKind)) return null;
  const text = typeof e.text === "string" ? e.text.slice(0, JOURNAL_MAX_TEXT) : "";
  const checked = Array.isArray(e.checked) ? e.checked.filter((id): id is string => typeof id === "string" && id.length <= 64).slice(0, 60) : [];
  const images = Array.isArray(e.images) ? e.images.filter((r): r is string => typeof r === "string" && isImageRef(r)).slice(0, JOURNAL_MAX_IMAGES) : [];
  if (!text.trim() && checked.length === 0 && images.length === 0) return null;
  return {
    id: e.id, at: e.at, kind: e.kind as JournalKind,
    topic: typeof e.topic === "string" && e.topic.length <= 64 ? e.topic : null,
    text,
    site: typeof e.site === "string" ? e.site.slice(0, SITE_MAX) : "",
    checked,
    images,
  };
}

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
  };
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
    rounds: devices.reduce((n, r) => n + r.rounds, 0),
    bestPercent: bests.length ? Math.max(...bests) : null,
    streak,
    lastDay,
  };
}

/** Klucze zdjęć dziennika w dokumencie — dla odśmiecania i synchronizacji obrazów. */
export function journalRefsIn(doc: Y.Doc): Set<string> {
  const refs = new Set<string>();
  doc.getMap<JournalEntry>("studyJournal").forEach((e) => {
    if (Array.isArray(e?.images)) for (const r of e.images) if (typeof r === "string" && isImageRef(r)) refs.add(r);
  });
  return refs;
}

export function createYStudy(doc: Y.Doc) {
  const journal = doc.getMap<JournalEntry>("studyJournal");
  const board = doc.getMap<Column>("studyBoard");
  const checked = doc.getMap<true>("studyChecked");
  const missed = doc.getMap<true>("studyMissed");
  const days = doc.getMap<true>("studyDays");
  /** Id urządzenia → jego rundy i najlepszy wynik. */
  const rounds = doc.getMap<DeviceRounds>("studyRounds");
  const meta = doc.getMap<unknown>("studyMeta");
  /** Urządzenia, których stary zapis jest już w dokumencie (id urządzenia → czas). */
  const migrations = doc.getMap<number>("studyMigrations");

  let snapshot: StudyState | null = null;
  const listeners = new Set<() => void>();
  const onChange = () => {
    snapshot = null;
    listeners.forEach((l) => l());
  };
  for (const m of [journal, board, checked, missed, days, rounds, meta]) m.observe(onChange);

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
    });
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

  /**
   * Runda quizu na urządzeniu `device`: licznik i najlepszy wynik tego urządzenia,
   * dzień do serii, zdegradowane tematy i zmiany listy błędów — jedną transakcją.
   */
  function recordRound(device: string, percent: number, day: string, demote: string[], results: { id: string; ok: boolean }[]): void {
    transact(() => {
      const prev = rounds.get(device);
      const best = prev?.best ?? null;
      rounds.set(device, { rounds: (prev?.rounds ?? 0) + 1, best: best === null ? percent : Math.max(best, percent) });
      if (DAY_RE.test(day) && !days.has(day)) days.set(day, true);
      for (const id of demote) if (board.get(id) === "done") board.set(id, "doing");
      for (const r of results) toggleIn(missed, r.id, !r.ok);
    });
  }

  /** Dopisuje wpis; problem przy temacie z „Umiem” cofa go do „W trakcie”. */
  function addEntry(entry: JournalEntry): void {
    transact(() => {
      journal.set(entry.id, entry);
      if (entry.kind === "problem" && entry.topic && board.get(entry.topic) === "done") board.set(entry.topic, "doing");
    });
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

  function setSite(site: string): void {
    transact(() => { if (meta.get("site") !== site) meta.set("site", site); });
  }

  /** Cała Nauka naraz (przywrócenie kopii) — zastępuje, nie scala. */
  function replaceAll(data: StudyDump): void {
    const d = cleanDump(data);
    transact(() => {
      for (const m of [journal, board, checked, missed, days, rounds] as Y.Map<unknown>[]) for (const k of Array.from(m.keys())) m.delete(k);
      for (const e of d.journal) journal.set(e.id, e);
      for (const [k, v] of Object.entries(d.board)) board.set(k, v);
      for (const k of Object.keys(d.checked)) checked.set(k, true);
      for (const k of Object.keys(d.missed)) missed.set(k, true);
      for (const k of d.days) days.set(k, true);
      for (const [k, v] of Object.entries(d.rounds)) rounds.set(k, v);
      meta.set("site", d.site);
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
      if (!meta.has("site") && d.site) meta.set("site", d.site);
    }, MIGRATION_ORIGIN);
  }

  const isMerged = (marker: string) => migrations.has(marker);

  return {
    get, dump, subscribe, isMerged,
    setColumn, setChecked, clearChecked, recordRound,
    addEntry, restoreEntry, removeEntry, setSite,
    replaceAll, mergeIn,
  };
}

export type YStudy = ReturnType<typeof createYStudy>;
