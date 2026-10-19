import { useMemo, useSyncExternalStore } from "react";
import type { Fitting } from "./fittings";
import { CHECKLIST, QUESTIONS, TOPICS, type ChecklistItem, type Question } from "./content";
import { CUSTOM_MAX, CUSTOM_PREFIX, CUSTOM_TEXT_MAX, cleanCustom, cleanCustomList, questionOptions, type CustomEntry, type CustomItem, type CustomQuestion } from "./custom";
import { localDayKey } from "@/lib/dayDone";
import { addDaysToKey } from "@/lib/week";
import { studyDevice, yStudy } from "./data";
import { cleanCard, dueIds, type ReviewCard } from "./srs";
import type { PressureTest } from "./pressureTest";
import { cleanGeo, type GeoPoint } from "./geo";
import { BOSS_NAME_MAX, cleanBoss, cleanGroup, normalizeGroupLink, normalizePhone } from "./boss";
import { cleanSite, entrySiteId, resolveSite, siteDirectory, SITE_NAME_MAX, type SiteCard, type SiteInfo } from "./sites";
import { cleanStages, type SiteStage } from "./stages";
import { cleanShortages, logOrder, type OrderLogEntry, type Shortage } from "./shortages";
import { siteOrder } from "./order";
import { cleanSiteHours, type SiteHours } from "./siteHours";
import { cleanSiteDocs, type SiteDoc } from "./siteDocs";
import { cleanServiceCalls, type ServiceCall } from "./service";
import {
  cleanEntryParts, JOURNAL_KINDS, JOURNAL_SOLUTION_MAX, SITE_MAX,
  type Column, type JournalEntry, type JournalKind, type StudyState,
} from "./yStudy";

export { COLUMNS, JOURNAL_KINDS, JOURNAL_MAX_IMAGES, JOURNAL_MAX_TEXT, JOURNAL_SOLUTION_MAX } from "./yStudy";
export type { Column, JournalEntry, JournalKind, StudyState } from "./yStudy";
export type { SiteCard, SiteInfo } from "./sites";
export type { Boss, WaGroup } from "./boss";

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
    const e = raw as Partial<JournalEntry> | null;
    if (!e || typeof e !== "object") continue;
    if (typeof e.id !== "string" || !e.id || e.id.length > 64) continue;
    if (typeof e.at !== "number" || !Number.isFinite(e.at)) continue;
    if (!JOURNAL_KINDS.includes(e.kind as JournalKind)) continue;
    const parts = cleanEntryParts(e);
    // Pustość przed odrzuceniem nieznanych punktów: wpis z odhaczeniami, których punkt już nie istnieje,
    // zostaje jako zapis (wcześniej znikał z dziennika, raportów i serii, a zostawał w kopii).
    if (parts.empty) continue;
    const topic = typeof e.topic === "string" && topicIds.has(e.topic) ? e.topic : null;
    journal.push({
      id: e.id, at: e.at, kind: e.kind as JournalKind, topic, text: parts.text,
      site: typeof e.site === "string" ? e.site.slice(0, SITE_MAX) : "",
      ...(typeof e.siteId === "string" && e.siteId && e.siteId.length <= 64 ? { siteId: e.siteId } : {}),
      checked: parts.checked.filter((id) => itemIds.has(id)),
      images: parts.images,
      ...(e.kind === "problem" && typeof e.resolved === "number" && Number.isFinite(e.resolved) ? { resolved: e.resolved } : {}),
      ...(e.kind === "problem" && typeof e.solution === "string" && e.solution.trim() ? { solution: e.solution.trim().slice(0, JOURNAL_SOLUTION_MAX) } : {}),
      ...(parts.test ? { test: parts.test } : {}),
      ...(parts.fittings.length ? { fittings: parts.fittings } : {}),
      ...(parts.stage ? { stage: parts.stage } : {}),
      ...(parts.geo ? { geo: parts.geo } : {}),
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
  return { board, checked, bestPercent: best, rounds, missed, journal, site, sites, streak, lastDay, review, boss: cleanBoss(s.boss), group: cleanGroup(s.group), custom,
    days: Array.isArray(s.days) ? s.days.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [] };
}

/** Materiał G-HEAT i własne wpisy razem — to widzą listy, quiz, tablica i dziennik. */
export function studyLists(custom: readonly CustomEntry[]): { checklist: ChecklistItem[]; questions: Question[] } {
  const checklist: ChecklistItem[] = [...CHECKLIST];
  const questions: Question[] = [...QUESTIONS];
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

const DEFAULTS: StudyState = { board: {}, checked: {}, bestPercent: null, rounds: 0, missed: {}, journal: [], site: "", sites: {}, streak: 0, lastDay: null, review: {}, boss: null, group: null, days: [], custom: [] };

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

/** Czyści odhaczenia; zwraca, co było odhaczone — do „Cofnij”. */
export function resetChecklist(): string[] {
  const ids = Object.keys(getStudy().checked);
  yStudy.clearChecked();
  return ids;
}

export function restoreChecklist(ids: string[]) {
  yStudy.restoreChecked(ids);
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
  /** Protokół próby szczelności; `null`/brak = bez próby. */
  test?: PressureTest | null;
  /** Zużyte kształtki; puste/brak = bez kształtek. */
  fittings?: Fitting[];
  /** Etap budowy zamknięty tym wpisem (id z karty); `null`/brak = bez etapu. */
  stage?: string | null;
  /** „Tu jestem” — lokalizacja wpisu; `null`/brak = bez lokalizacji. Sama nie czyni wpisu niepustym. */
  geo?: GeoPoint | null;
}

/** Wejście z arkusza → pola wpisu przefiltrowane przez materiał; `null` = pusty wpis. */
function entryFields(input: NewJournalEntry, now: number) {
  const items = studyLists(getStudy().custom).checklist;
  // Odhaczenia tylko z istniejących punktów — pustość liczona po tym filtrze (w odróżnieniu od `sanitizeStudy`).
  const parts = cleanEntryParts({
    text: input.text.trim(),
    checked: (input.checked ?? []).filter((id) => items.some((c) => c.id === id)),
    images: input.images ?? [],
    test: input.test,
    fittings: input.fittings,
    stage: input.stage,
    geo: input.geo,
  });
  if (parts.empty) return null;
  const { text, checked, images, test, fittings, stage, geo } = parts;
  return {
    at: typeof input.at === "number" && Number.isFinite(input.at) ? Math.min(input.at, now) : now,
    kind: input.kind,
    topic: input.topic && TOPICS.some((t) => t.id === input.topic) ? input.topic : null,
    text,
    checked,
    images,
    ...(test ? { test } : {}),
    ...(fittings.length ? { fittings } : {}),
    ...(stage ? { stage } : {}),
    ...(geo ? { geo } : {}),
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
  // Opis rozwiązania nie jest w formularzu arkusza — zostaje z zapisanego wpisu, dopóki to problem.
  const prevSolution = s.journal.find((e) => e.id === id)?.solution;
  const entry: JournalEntry = {
    id, ...fields, site,
    ...(siteId ? { siteId } : {}),
    ...(fields.kind === "problem" && input.resolved !== null ? { resolved: input.resolved } : {}),
    ...(fields.kind === "problem" && prevSolution ? { solution: prevSolution } : {}),
  };
  yStudy.updateEntry(entry, card);
  return entry;
}

/** Problem rozwiązany albo z powrotem otwarty — z listy, bez otwierania arkusza. */
export function setProblemResolved(id: string, resolved: boolean, now: number = Date.now()) {
  yStudy.setResolved(id, resolved ? now : null);
}

/** Jak problem rozwiązano — baza własnych rozwiązań; pusty tekst usuwa opis. */
export function setProblemSolution(id: string, text: string) {
  yStudy.setSolution(id, text);
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

/** Własne punkty i pytania (N5): zapis tylko dla znanego tematu i w limicie. `null` = odrzucone. */
function addCustomEntry(entry: CustomEntry | null): CustomEntry | null {
  if (!entry || !TOPICS.some((t) => t.id === entry.topic)) return null;
  if (getStudy().custom.length >= CUSTOM_MAX) return null;
  yStudy.addCustom(entry);
  return entry;
}

export function addCustomItem(topic: string, text: string): CustomItem | null {
  const t = text.trim();
  if (!t || t.length > CUSTOM_TEXT_MAX) return null;
  return addCustomEntry(cleanCustom({ kind: "item", id: CUSTOM_PREFIX + crypto.randomUUID(), topic, text: t })) as CustomItem | null;
}

export interface CustomQuestionInput {
  topic: string;
  question: string;
  correct: string;
  wrong: [string, string, string];
  explanation: string;
}

/** `null` = niepoprawne (np. dwie takie same odpowiedzi, za długie pole). */
export function addCustomQuestion(input: CustomQuestionInput): CustomQuestion | null {
  const raw = { kind: "question", id: CUSTOM_PREFIX + crypto.randomUUID(), ...input };
  return addCustomEntry(cleanCustom(raw)) as CustomQuestion | null;
}

/** Usuwa własny wpis; zwraca go do „Cofnij”. */
export function removeCustomEntry(id: string): CustomEntry | null {
  return yStudy.removeCustom(id);
}

export function restoreCustomEntry(entry: CustomEntry) {
  yStudy.restoreCustom(entry);
}

/**
 * Zapisuje szefa (imię i numer WhatsApp). Pusty numer usuwa kontakt;
 * niepoprawny → `false`, nic się nie zmienia.
 */
export function saveBoss(name: string, phone: string): boolean {
  if (!phone.trim()) { yStudy.setBoss(null); return true; }
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  yStudy.setBoss({ name: name.trim().slice(0, BOSS_NAME_MAX), phone: normalized });
  return true;
}

/**
 * Zapisuje grupę WhatsApp na raporty. Pusta nazwa usuwa grupę; link opcjonalny,
 * ale wpisany musi być linkiem zaproszenia (`chat.whatsapp.com/…`) → inaczej `false`.
 */
export function saveGroup(name: string, link: string): boolean {
  if (!name.trim()) { yStudy.setGroup(null); return true; }
  const normalized = link.trim() ? normalizeGroupLink(link) : "";
  if (normalized === null) return false;
  yStudy.setGroup({ name: name.trim().slice(0, BOSS_NAME_MAX), link: normalized });
  return true;
}

export function setSite(site: string) {
  yStudy.setSite(site.slice(0, SITE_MAX));
}

export interface SiteCardInput {
  name: string;
  address: string;
  investor: string;
  phone?: string;
  manager?: string;
  managerPhone?: string;
  access?: string;
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
  // Reszta karty (archiwum, zamówienia, etapy, braki…) zostaje — edycja zmienia tylko pola formularza.
  const { stored: _s, count: _c, open: _o, first: _f, last: _l, phone: _p, manager: _m, managerPhone: _mp, access: _a, ...rest } =
    prev ?? ({} as Partial<SiteInfo>);
  // Pola kontaktu z formularza; pole pominięte w `input` zostaje takie, jak było.
  const keep = (k: "phone" | "manager" | "managerPhone" | "access") => input[k] ?? prev?.[k];
  const card = cleanSite({
    ...rest,
    id, name,
    address: input.address,
    investor: input.investor,
    phone: keep("phone"), manager: keep("manager"), managerPhone: keep("managerPhone"), access: keep("access"),
    created: prev?.created ?? now,
  });
  if (!card) return false;
  // `cleanSite` przepuszcza listy karty tylko w znanym kształcie — zostają takie, jak były.
  yStudy.saveSite({ ...rest, ...card, id }, prev?.name);
  return true;
}

/**
 * Zmienia pola karty budowy, zachowując resztę. Budowa znana tylko z nazw we wpisach dostaje
 * przy tym kartę w dokumencie. Nieznana budowa — nic.
 */
function patchSiteCard(id: string, patch: Partial<Pick<SiteCard, "orderedAt">>) {
  const s = getStudy();
  const prev = siteDirectory(s.sites, s.journal).find((x) => x.id === id);
  if (!prev) return;
  const { stored: _s, count: _c, open: _o, first: _f, last: _l, ...card } = prev;
  yStudy.saveSite({ ...card, ...patch });
}

/**
 * Lista karty budowy przed zmianą — punkt wyjścia zapisu różnicy (`yStudy.setSiteList`). Lista jeszcze
 * nie zapisana (np. domyślne etapy) to pusta baza: wtedy zapisują się wszystkie pozycje, nie tylko zmienione.
 * Budowa znana tylko z nazw we wpisach dostaje przy tym kartę w dokumencie.
 */
function siteListBase<T>(id: string, field: "stages" | "shortages" | "orders" | "hours" | "docs" | "service", uiBase: readonly T[] | undefined): readonly T[] | null {
  const s = getStudy();
  const prev = siteDirectory(s.sites, s.journal).find((x) => x.id === id);
  if (!prev) return null;
  if (!prev.stored) patchSiteCard(id, {});
  const stored = prev[field] as T[] | undefined;
  if (stored === undefined) return [];
  return uiBase ?? stored;
}

/** Zaznacza zamówienie kształtek na teraz: od tej chwili lista „do zamówienia” zaczyna się od zera. */
export function markSiteOrdered(id: string, now: number = Date.now()) {
  const s = getStudy();
  const prev = siteDirectory(s.sites, s.journal).find((x) => x.id === id);
  if (!prev) return;
  // Co właśnie zamówiono — do historii zamówień w karcie.
  const items = siteOrder(s.journal, id, prev.orderedAt).items;
  patchSiteCard(id, { orderedAt: now });
  const base = siteListBase<OrderLogEntry>(id, "orders", undefined) ?? [];
  yStudy.setSiteList(id, "order", logOrder(prev.orders, items, now), base);
}

/**
 * Lista braków materiału po zmianie (dopisanie, status, usunięcie). `base` — lista, od której zaczął
 * użytkownik (z ekranu); zapisuje się tylko różnica, więc zmiany z drugiego telefonu nie giną.
 */
export function setSiteShortages(id: string, shortages: Shortage[], base?: readonly Shortage[]) {
  const from = siteListBase(id, "shortages", base);
  if (from === null) return;
  yStudy.setSiteList(id, "short", cleanShortages(shortages) ?? [], from);
}

/** Lista etapów budowy po zmianie (odhaczenie, dodanie, usunięcie); `base` jak przy brakach. */
export function setSiteStages(id: string, stages: SiteStage[], base?: readonly SiteStage[]) {
  const from = siteListBase(id, "stages", base);
  if (from === null) return;
  yStudy.setSiteList(id, "stage", cleanStages(stages) ?? [], from);
}

/**
 * Podział godzin dnia `day` między budowy (minuty; 0 = bez godzin na tej budowie). Każda budowa
 * zmienia tylko pozycję tego dnia — inne dni i zmiany z drugiego telefonu zostają.
 */
export function setDayHours(day: string, minutes: Readonly<Record<string, number>>) {
  for (const [id, min] of Object.entries(minutes)) {
    const from = siteListBase<SiteHours>(id, "hours", undefined);
    if (from === null) continue;
    const others = from.filter((h) => h.id !== day);
    const next = min > 0 ? [...others, { id: day, minutes: min }] : others;
    yStudy.setSiteList(id, "hours", cleanSiteHours(next) ?? [], from);
  }
}

/** Plany i dokumenty budowy po zmianie (dodanie, usunięcie); `base` jak przy brakach. */
export function setSiteDocs(id: string, docs: SiteDoc[], base?: readonly SiteDoc[]) {
  const from = siteListBase(id, "docs", base);
  if (from === null) return;
  yStudy.setSiteList(id, "docs", cleanSiteDocs(docs) ?? [], from);
}

/** Zgłoszenia serwisowe po zmianie (dodanie, zamknięcie, usunięcie); `base` jak przy brakach. */
export function setSiteService(id: string, calls: ServiceCall[], base?: readonly ServiceCall[]) {
  const from = siteListBase(id, "service", base);
  if (from === null) return;
  yStudy.setSiteList(id, "service", cleanServiceCalls(calls) ?? [], from);
}

/** Koniec gwarancji („2028-10-16”) albo `null` — bez gwarancji. */
export function setSiteWarranty(id: string, warranty: string | null) {
  const s = getStudy();
  const prev = siteDirectory(s.sites, s.journal).find((x) => x.id === id);
  if (!prev) return;
  const { stored: _s, count: _c, open: _o, first: _f, last: _l, warranty: _w, ...card } = prev;
  yStudy.saveSite(warranty ? { ...card, warranty } : card);
}

/** Lokalizacja budowy zapisana na miejscu („Zapisz lokalizację budowy”); `null` usuwa. */
export function setSiteGeo(id: string, geo: GeoPoint | null) {
  const s = getStudy();
  const prev = siteDirectory(s.sites, s.journal).find((x) => x.id === id);
  if (!prev) return;
  const { stored: _s, count: _c, open: _o, first: _f, last: _l, geo: _g, ...card } = prev;
  const clean = cleanGeo(geo);
  yStudy.saveSite(clean ? { ...card, geo: clean } : card);
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
  /** Ostatni problem z tematem — otwarty ma pierwszeństwo przed nowszym rozwiązanym. */
  lastProblem?: JournalEntry;
  /** Rozwiązane problemy z opisem rozwiązania, od najnowszego — „Moje rozwiązania”. */
  solutions: JournalEntry[];
}

/** Ile razy temat pojawił się na budowie i ile razy sprawił problem. */
export function practiceByTopic(journal: readonly JournalEntry[]): Map<string, TopicPractice> {
  const out = new Map<string, TopicPractice>();
  for (const e of journal) {
    if (!e.topic) continue;
    const p = out.get(e.topic) ?? { ok: 0, problem: 0, last: 0, solutions: [] };
    if (e.kind === "ok") p.ok += 1;
    else if (e.kind === "problem") {
      p.problem += 1;
      const prev = p.lastProblem;
      const open = e.resolved === undefined;
      const prevOpen = prev?.resolved === undefined;
      if (!prev || (open && !prevOpen) || (open === prevOpen && e.at > prev.at)) p.lastProblem = e;
      if (!open && e.solution) p.solutions.push(e);
    }
    p.last = Math.max(p.last, e.at);
    out.set(e.topic, p);
  }
  for (const p of out.values()) p.solutions.sort((a, b) => (b.resolved ?? b.at) - (a.resolved ?? a.at));
  return out;
}
