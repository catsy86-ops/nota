import type { Fitting } from "./fittings";
import type { Attachment } from "@/lib/attachments";
import { TOPICS } from "./content";
import { yStudy } from "./data";
import type { PressureTest } from "./pressureTest";
import { type GeoPoint } from "./geo";
import { BOSS_NAME_MAX, normalizeGroupLink, normalizePhone } from "./boss";
import { resolveSite } from "./sites";
import { cleanEntryParts, type JournalEntry, type JournalKind } from "./yStudy";
import { getStudy, siteDirectoryOf, studyLists } from "./studyProjection";

/** Akcje dziennika z budowy (H0.2, z `store.ts`): wpisy, problemy i usterki, odbiorcy raportu, praktyka tematów. */

export interface NewJournalEntry {
  kind: JournalKind;
  topic: string | null;
  text: string;
  checked?: string[];
  images?: string[];
  /** Podpisy zdjęć (ref → tekst); czyszczone przez `cleanEntryParts` (tylko zdjęcia ze `images`). */
  captions?: Record<string, string>;
  /** Oryginały narysowanych zdjęć (ref rysunku → ref oryginału, H0.1); czyszczone jak podpisy. */
  drawnFrom?: Record<string, string>;
  /** Nagrania głosowe (załączniki audio); brak = bez nagrań. Nagranie samo wystarcza, by wpis nie był pusty (jak zdjęcie). */
  recordings?: Attachment[];
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
    captions: input.captions,
    drawnFrom: input.drawnFrom,
    recordings: input.recordings ?? [],
    test: input.test,
    fittings: input.fittings,
    stage: input.stage,
    geo: input.geo,
  });
  if (parts.empty) return null;
  const { text, checked, images, captions, drawnFrom, recordings, test, fittings, stage, geo } = parts;
  return {
    at: typeof input.at === "number" && Number.isFinite(input.at) ? Math.min(input.at, now) : now,
    kind: input.kind,
    topic: input.topic && TOPICS.some((t) => t.id === input.topic) ? input.topic : null,
    text,
    checked,
    images,
    ...(Object.keys(captions).length ? { captions } : {}),
    ...(Object.keys(drawnFrom).length ? { drawnFrom } : {}),
    ...(recordings.length ? { recordings } : {}),
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
  const { siteId, site, card } = resolveSite(siteDirectoryOf(s), s.site, now);
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
  const { siteId, site, card } = resolveSite(siteDirectoryOf(s), input.site, now);
  // Opis rozwiązania i pola usterki (P2.3: odpowiedzialny, termin, zdjęcia po naprawie) nie są w formularzu
  // arkusza — zostają z zapisanego wpisu, dopóki to problem. Bez tego poprawka tekstu je kasowała.
  const prev = s.journal.find((e) => e.id === id);
  const kept = fields.kind === "problem" && prev ? { solution: prev.solution, owner: prev.owner, due: prev.due, after: prev.after } : {};
  const entry: JournalEntry = {
    id, ...fields, site,
    ...(siteId ? { siteId } : {}),
    ...(fields.kind === "problem" && input.resolved !== null ? { resolved: input.resolved } : {}),
    ...Object.fromEntries(Object.entries(kept).filter(([, v]) => v !== undefined)),
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

/** Usterka (P2.3): odpowiedzialny, termin i zdjęcia po naprawie; pusta wartość kasuje pole. */
export function setProblemFault(id: string, patch: { owner?: string; due?: string | null; after?: string[] }) {
  yStudy.setFault(id, patch);
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
