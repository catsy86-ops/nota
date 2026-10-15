import { useSyncExternalStore } from "react";
import { isImageRef } from "@/lib/imageStore";
import { CHECKLIST, QUESTIONS, TOPICS } from "./content";
import { localDayKey } from "@/lib/dayDone";
import { addDaysToKey } from "@/lib/week";
import { studyDevice, yStudy } from "./data";
import { cleanCard, dueIds, type ReviewCard } from "./srs";
import { cleanSite, entrySiteId, resolveSite, siteDirectory, SITE_FIELD_MAX, SITE_NAME_MAX, type SiteCard } from "./sites";
import {
  JOURNAL_KINDS, JOURNAL_MAX_IMAGES, JOURNAL_MAX_TEXT, SITE_MAX,
  type Column, type JournalEntry, type JournalKind, type StudyState,
} from "./yStudy";

export { COLUMNS, JOURNAL_KINDS, JOURNAL_MAX_IMAGES, JOURNAL_MAX_TEXT } from "./yStudy";
export type { Column, JournalEntry, JournalKind, StudyState } from "./yStudy";
export type { SiteCard, SiteInfo } from "./sites";

/**
 * Nauka żyje w dokumencie Yjs notatek (`yStudy.ts`, instancja w `data.ts`),
 * więc synchronizuje się razem z nimi. Ten moduł to fasada dla widoków /nauka:
 * projekcja przefiltrowana przez materiał (`sanitizeStudy`) i akcje.
 */

const isColumn = (v: unknown): v is Column => v === "todo" || v === "doing" || v === "done";

/** Zostawia tylko znane klucze i poprawne wartości — uszkodzony zapis nie psuje widoku. */
export function sanitizeStudy(defaults: StudyState, stored: unknown): StudyState {
  if (!stored || typeof stored !== "object") return defaults;
  const s = stored as Partial<StudyState>;
  const topicIds = new Set(TOPICS.map((t) => t.id));
  const board: Record<string, Column> = {};
  for (const [id, col] of Object.entries(s.board ?? {})) {
    if (topicIds.has(id) && isColumn(col) && col !== "todo") board[id] = col;
  }
  const itemIds = new Set(CHECKLIST.map((c) => c.id));
  const checked: Record<string, true> = {};
  for (const [id, v] of Object.entries(s.checked ?? {})) if (v === true && itemIds.has(id)) checked[id] = true;
  const best = typeof s.bestPercent === "number" && s.bestPercent >= 0 && s.bestPercent <= 100 ? Math.round(s.bestPercent) : null;
  const rounds = typeof s.rounds === "number" && s.rounds >= 0 ? Math.floor(s.rounds) : 0;
  const questionIds = new Set(QUESTIONS.map((q) => q.id));
  const missed: Record<string, true> = {};
  for (const [id, v] of Object.entries(s.missed ?? {})) if (v === true && questionIds.has(id)) missed[id] = true;
  const journal: JournalEntry[] = [];
  for (const raw of Array.isArray(s.journal) ? s.journal : []) {
    const e = raw as Partial<JournalEntry> | null;
    if (!e || typeof e !== "object") continue;
    if (typeof e.id !== "string" || !e.id || e.id.length > 64) continue;
    if (typeof e.at !== "number" || !Number.isFinite(e.at)) continue;
    if (!JOURNAL_KINDS.includes(e.kind as JournalKind)) continue;
    const text = typeof e.text === "string" ? e.text.slice(0, JOURNAL_MAX_TEXT) : "";
    const topic = typeof e.topic === "string" && topicIds.has(e.topic) ? e.topic : null;
    const checkedIds = Array.isArray(e.checked) ? e.checked.filter((id): id is string => typeof id === "string" && itemIds.has(id)).slice(0, 60) : [];
    const images = Array.isArray(e.images)
      ? e.images.filter((r): r is string => typeof r === "string" && isImageRef(r)).slice(0, JOURNAL_MAX_IMAGES)
      : [];
    if (!text.trim() && checkedIds.length === 0 && images.length === 0) continue;
    journal.push({
      id: e.id, at: e.at, kind: e.kind as JournalKind, topic, text,
      site: typeof e.site === "string" ? e.site.slice(0, SITE_MAX) : "",
      ...(typeof e.siteId === "string" && e.siteId && e.siteId.length <= 64 ? { siteId: e.siteId } : {}),
      checked: checkedIds,
      images,
      ...(e.kind === "problem" && typeof e.resolved === "number" && Number.isFinite(e.resolved) ? { resolved: e.resolved } : {}),
    });
  }
  journal.sort((a, b) => a.at - b.at);
  const sites: Record<string, SiteCard> = {};
  for (const [id, raw] of Object.entries(s.sites ?? {})) {
    const card = cleanSite(raw);
    if (card && card.id === id) sites[id] = card;
  }
  // Każdy wpis z budową ma `siteId`, a nazwę — aktualną z karty.
  for (const e of journal) {
    const id = entrySiteId(e);
    if (!id) continue;
    e.siteId = id;
    if (sites[id]) e.site = sites[id].name;
  }
  const site = typeof s.site === "string" ? s.site.slice(0, SITE_MAX) : "";
  const lastDay = typeof s.lastDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.lastDay) ? s.lastDay : null;
  const streak = lastDay && typeof s.streak === "number" && s.streak >= 1 ? Math.floor(s.streak) : 0;
  const review: Record<string, ReviewCard> = {};
  for (const [id, raw] of Object.entries(s.review ?? {})) {
    const card = questionIds.has(id) ? cleanCard(raw) : null;
    if (card) review[id] = card;
  }
  return { board, checked, bestPercent: best, rounds, missed, journal, site, sites, streak, lastDay, review };
}

const DEFAULTS: StudyState = { board: {}, checked: {}, bestPercent: null, rounds: 0, missed: {}, journal: [], site: "", sites: {}, streak: 0, lastDay: null, review: {} };

let lastRaw: StudyState | null = null;
let lastClean: StudyState = DEFAULTS;

/** Projekcja dokumentu przefiltrowana przez materiał; ta sama referencja, dopóki dokument się nie zmieni. */
export function getStudy(): StudyState {
  const raw = yStudy.get();
  if (raw !== lastRaw) { lastRaw = raw; lastClean = sanitizeStudy(DEFAULTS, raw); }
  return lastClean;
}

export const useStudy = () => useSyncExternalStore(yStudy.subscribe, getStudy);

/** Seria, która jeszcze trwa: ostatnia runda dziś albo wczoraj; starsza już przepadła. */
export function activeStreak(state: Pick<StudyState, "streak" | "lastDay">, today = localDayKey()): number {
  if (!state.lastDay) return 0;
  return state.lastDay === today || state.lastDay === addDaysToKey(today, -1) ? state.streak : 0;
}

/** Pytania do powtórki na dziś (termin minął), od najbardziej zaległych — „Na dziś: N”. */
export function dueToday(state: Pick<StudyState, "review">, today = localDayKey()): string[] {
  return dueIds(state.review, today);
}

export function columnOf(state: StudyState, topicId: string): Column {
  return state.board[topicId] ?? "todo";
}

export function moveTopic(topicId: string, column: Column) {
  yStudy.setColumn(topicId, column);
}

export function toggleChecked(itemId: string) {
  yStudy.setChecked(itemId, !getStudy().checked[itemId]);
}

export function resetChecklist() {
  yStudy.clearChecked();
}

/**
 * Zapisuje wynik rundy; tematy z błędami wracają z „Umiem” do „W trakcie”.
 * `results` aktualizuje listę błędnych pytań: dobra odpowiedź ją czyści, zła dopisuje.
 */
export function recordRound(
  correct: number,
  total: number,
  missed: string[],
  results: { id: string; ok: boolean }[] = [],
  today = localDayKey(),
): { demoted: string[]; streak: number; streakGrew: boolean } {
  const s = getStudy();
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const demoted = [...new Set(missed)].filter((id) => s.board[id] === "done");
  const streakGrew = s.lastDay !== today;
  yStudy.recordRound(studyDevice(), percent, today, demoted, results);
  return { demoted, streak: activeStreak(getStudy(), today), streakGrew };
}

export interface NewJournalEntry {
  kind: JournalKind;
  topic: string | null;
  text: string;
  checked?: string[];
  images?: string[];
  /** Moment wpisu („za wczoraj”); brak = teraz. Przyszłość przycina się do teraz. */
  at?: number | null;
}

/** Wejście z arkusza → pola wpisu przefiltrowane przez materiał; `null` = pusty wpis. */
function entryFields(input: NewJournalEntry, now: number) {
  const text = input.text.trim().slice(0, JOURNAL_MAX_TEXT);
  const checked = (input.checked ?? []).filter((id) => CHECKLIST.some((c) => c.id === id));
  const images = (input.images ?? []).filter(isImageRef).slice(0, JOURNAL_MAX_IMAGES);
  if (!text && checked.length === 0 && images.length === 0) return null;
  return {
    at: typeof input.at === "number" && Number.isFinite(input.at) ? Math.min(input.at, now) : now,
    kind: input.kind,
    topic: input.topic && TOPICS.some((t) => t.id === input.topic) ? input.topic : null,
    text,
    checked,
    images,
  };
}

/**
 * Dopisuje wpis z budowy. Problem przy temacie z kolumny „Umiem” cofa go do „W trakcie” —
 * teoria nie wytrzymała praktyki, więc wraca do powtórki (i na początek quizu).
 */
export function addJournalEntry(input: NewJournalEntry, now: number = Date.now()): JournalEntry | null {
  const fields = entryFields(input, now);
  if (!fields) return null;
  const s = getStudy();
  const { siteId, site, card } = resolveSite(siteDirectory(s.sites, s.journal), s.site, now);
  const entry: JournalEntry = { id: crypto.randomUUID(), ...fields, site, ...(siteId ? { siteId } : {}) };
  yStudy.addEntry(entry, card);
  return entry;
}

export interface JournalEdit extends NewJournalEntry {
  site: string;
  /** Problem rozwiązany: moment rozwiązania; `null` = otwarty. Inny rodzaj gubi rozwiązanie. */
  resolved: number | null;
}

/** Zapisuje zmiany wpisu z arkusza; `null` = pusty wpis (nic się nie zmienia). */
export function updateJournalEntry(id: string, input: JournalEdit, now: number = Date.now()): JournalEntry | null {
  const fields = entryFields(input, now);
  if (!fields) return null;
  const s = getStudy();
  const { siteId, site, card } = resolveSite(siteDirectory(s.sites, s.journal), input.site, now);
  const entry: JournalEntry = {
    id, ...fields, site,
    ...(siteId ? { siteId } : {}),
    ...(fields.kind === "problem" && input.resolved !== null ? { resolved: input.resolved } : {}),
  };
  yStudy.updateEntry(entry, card);
  return entry;
}

/** Problem rozwiązany albo z powrotem otwarty — z listy, bez otwierania arkusza. */
export function setProblemResolved(id: string, resolved: boolean, now: number = Date.now()) {
  yStudy.setResolved(id, resolved ? now : null);
}

/** Problemy, które czekają na rozwiązanie. */
export const openProblems = (journal: readonly JournalEntry[]) =>
  journal.filter((e) => e.kind === "problem" && e.resolved === undefined).length;

/** Przywraca usunięty wpis (Cofnij) na właściwe miejsce w czasie. */
export function restoreJournalEntry(entry: JournalEntry) {
  yStudy.restoreEntry(entry);
}

export function removeJournalEntry(id: string): JournalEntry | null {
  return yStudy.removeEntry(id);
}

export function setSite(site: string) {
  yStudy.setSite(site.slice(0, SITE_MAX));
}

export interface SiteCardInput {
  name: string;
  address: string;
  investor: string;
}

/**
 * Zapisuje kartę budowy (też budowy znanej tylko z nazw we wpisach — wtedy karta powstaje).
 * Pusta nazwa → `false`, nic się nie zmienia.
 */
export function saveSiteCard(id: string, input: SiteCardInput, now: number = Date.now()): boolean {
  const name = input.name.trim().slice(0, SITE_NAME_MAX);
  if (!name) return false;
  const s = getStudy();
  const prev = siteDirectory(s.sites, s.journal).find((x) => x.id === id);
  yStudy.saveSite({
    id, name,
    address: input.address.trim().slice(0, SITE_FIELD_MAX),
    investor: input.investor.trim().slice(0, SITE_FIELD_MAX),
    created: prev?.created ?? now,
    ...(prev?.archived !== undefined ? { archived: prev.archived } : {}),
  }, prev?.name);
  return true;
}

/** Budowa do archiwum (`true`) albo z powrotem czynna. */
export function setSiteArchived(id: string, archived: boolean, now: number = Date.now()) {
  const s = getStudy();
  const prev = siteDirectory(s.sites, s.journal).find((x) => x.id === id);
  if (!prev) return;
  const { archived: _, stored: _s, count: _c, open: _o, first: _f, last: _l, ...card } = prev;
  yStudy.saveSite(archived ? { ...card, archived: now } : card);
}

export interface TopicPractice {
  ok: number;
  problem: number;
  /** Moment ostatniego wpisu o temacie. */
  last: number;
}

/** Ile razy temat pojawił się na budowie i ile razy sprawił problem. */
export function practiceByTopic(journal: readonly JournalEntry[]): Map<string, TopicPractice> {
  const out = new Map<string, TopicPractice>();
  for (const e of journal) {
    if (!e.topic) continue;
    const p = out.get(e.topic) ?? { ok: 0, problem: 0, last: 0 };
    if (e.kind === "ok") p.ok += 1;
    else if (e.kind === "problem") p.problem += 1;
    p.last = Math.max(p.last, e.at);
    out.set(e.topic, p);
  }
  return out;
}
