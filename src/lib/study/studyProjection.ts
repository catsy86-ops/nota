import { useMemo, useSyncExternalStore } from "react";
import { CHECKLIST, QUESTIONS, TOPICS, type ChecklistItem, type Question } from "./content";
import { CALC_QUESTIONS } from "./calcQuestions";
import { cleanCustomList, questionOptions, type CustomEntry } from "./custom";
import { yStudy } from "./data";
import { cleanCard, type ReviewCard } from "./srs";
import { cleanBoss, cleanGroup } from "./boss";
import { cleanSite, entrySiteId, siteDirectory, type SiteCard, type SiteInfo } from "./sites";
import { cleanShortagesCounted } from "./shortages";
import { cleanEntry, SITE_MAX, type Column, type JournalEntry, type StudyState } from "./yStudy";
import { cleanExam, keepLatestExams, type ExamResult } from "./exam";

/**
 * Projekcja Nauki dla widoków (H0.2, z `store.ts`): stan z dokumentu przefiltrowany przez materiał
 * (`sanitizeStudy`), listy materiału z własnymi wpisami i spis budów. Akcje importują stąd, nie ze
 * `store.ts` (fasada), żeby nie było cyklu.
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
  // Własne wpisy (N5) walidowane tu, bo tylko tu znane są tematy; potem liczą się jak materiał.
  const custom = cleanCustomList(s.custom).filter((e) => topicIds.has(e.topic));
  const lists = studyLists(custom);
  const itemIds = new Set(lists.checklist.map((c) => c.id));
  const checked: Record<string, true> = {};
  for (const [id, v] of Object.entries(s.checked ?? {})) if (v === true && itemIds.has(id)) checked[id] = true;
  const best = typeof s.bestPercent === "number" && s.bestPercent >= 0 && s.bestPercent <= 100 ? Math.round(s.bestPercent) : null;
  const rounds = typeof s.rounds === "number" && s.rounds >= 0 ? Math.floor(s.rounds) : 0;
  const questionIds = new Set(lists.questions.map((q) => q.id));
  const missed: Record<string, true> = {};
  for (const [id, v] of Object.entries(s.missed ?? {})) if (v === true && questionIds.has(id)) missed[id] = true;
  const journal: JournalEntry[] = [];
  for (const raw of Array.isArray(s.journal) ? s.journal : []) {
    // Kształt wpisu i pustość liczy `cleanEntry` (ta sama reguła co w kopii i dokumencie). Tu dochodzi
    // tylko filtr materiału: temat i odhaczenia muszą istnieć. Wpis z odhaczeniami bez punktu zostaje jako zapis.
    const base = cleanEntry(raw);
    if (!base) continue;
    const topic = base.topic && topicIds.has(base.topic) ? base.topic : null;
    journal.push({ ...base, topic, checked: base.checked.filter((id) => itemIds.has(id)) });
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
  const exams = keepLatestExams((Array.isArray(s.exams) ? s.exams : []).map(cleanExam).filter((e): e is ExamResult => e !== null));
  return { board, checked, bestPercent: best, rounds, missed, journal, site, sites, streak, lastDay, review, boss: cleanBoss(s.boss), group: cleanGroup(s.group), custom, exams,
    days: Array.isArray(s.days) ? s.days.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [] };
}

/** Materiał G-HEAT i własne wpisy razem — to widzą listy, quiz, tablica i dziennik. */
export function studyLists(custom: readonly CustomEntry[]): { checklist: ChecklistItem[]; questions: Question[] } {
  const checklist: ChecklistItem[] = [...CHECKLIST];
  const questions: Question[] = [...QUESTIONS, ...CALC_QUESTIONS];
  for (const e of custom) {
    if (e.kind === "item") checklist.push({ id: e.id, topic: e.topic, text: e.text });
    else questions.push({ id: e.id, topic: e.topic, question: e.question, options: questionOptions(e), explanation: e.explanation });
  }
  return { checklist, questions };
}

/** Listy z materiału i własnych wpisów; ta sama referencja, dopóki zmienią się własne wpisy. */
export function useStudyLists() {
  const custom = useStudy().custom;
  return useMemo(() => studyLists(custom), [custom]);
}

/** Braki ponad limit na budowę — liczone z surowego dokumentu, zanim `cleanSite` je przytnie. */
function droppedShortages(sites: Record<string, { shortages?: unknown }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, card] of Object.entries(sites)) {
    const d = cleanShortagesCounted(card.shortages).dropped;
    if (d > 0) out[id] = d;
  }
  return out;
}

const DEFAULTS: StudyState = { board: {}, checked: {}, bestPercent: null, rounds: 0, missed: {}, journal: [], site: "", sites: {}, streak: 0, lastDay: null, review: {}, boss: null, group: null, days: [], custom: [] };

let lastRaw: StudyState | null = null;
let lastClean: StudyState = DEFAULTS;

/** Projekcja dokumentu przefiltrowana przez materiał; ta sama referencja, dopóki dokument się nie zmieni. */
export function getStudy(): StudyState {
  const raw = yStudy.get();
  if (raw !== lastRaw) { lastRaw = raw; lastClean = { ...sanitizeStudy(DEFAULTS, raw), shortagesDropped: droppedShortages(raw.sites) }; }
  return lastClean;
}

export const useStudy = () => useSyncExternalStore(yStudy.subscribe, getStudy);

const directories = new WeakMap<StudyState, SiteInfo[]>();

/** Spis budów (`siteDirectory`) liczony raz na stan dokumentu — dziennik, arkusz, karta i wejście dzielą jeden wynik. */
export function siteDirectoryOf(s: StudyState): SiteInfo[] {
  let dir = directories.get(s);
  if (!dir) { dir = siteDirectory(s.sites, s.journal); directories.set(s, dir); }
  return dir;
}

/** Spis budów bieżącego stanu; ta sama referencja, dopóki dokument się nie zmieni. */
export const useSiteDirectory = () => siteDirectoryOf(useStudy());
