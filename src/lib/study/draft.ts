import { useSyncExternalStore } from "react";
import { createPersistedStore } from "@/lib/persistedStore";
import { type Fitting } from "./fittings";
import { type PressureTest } from "./pressureTest";
import { JOURNAL_DRAFT_KEY } from "./keys";
import { type GeoPoint } from "./geo";
import { cleanEntryParts, JOURNAL_KINDS, type JournalKind } from "./yStudy";
import type { Attachment } from "@/lib/attachments";

/**
 * Niezapisany wpis do dziennika. Trzymany poza komponentem: przejście na Quiz, „Wpis z budowy”
 * z karty tematu albo odświeżenie strony nie gubi tekstu ani zdjęć zrobionych na budowie.
 */
export interface JournalDraft {
  topic: string;
  kind: JournalKind;
  text: string;
  checked: string[];
  images: string[];
  /** Podpisy zdjęć (ref → tekst); starszy szkic dostaje `{}` (`sanitizeDraft`). */
  captions: Record<string, string>;
  /** Nagrania głosowe (załączniki audio); starszy szkic dostaje pustą listę (`sanitizeDraft`). */
  recordings: Attachment[];
  /** Protokół próby szczelności; `null` = bez próby. */
  test: PressureTest | null;
  /** Zużyte kształtki. */
  fittings: Fitting[];
  /** Moment wpisu ustawiony ręcznie („za wczoraj”); `null` = chwila zapisu. */
  at: number | null;
  /** Etap budowy odhaczony z tego wpisu (id z karty); `null` = bez etapu. Brak w starszym szkicu = `null`. */
  stage?: string | null;
  /** „Tu jestem” — lokalizacja wpisu; `null` = bez lokalizacji. Brak w starszym szkicu = `null`. */
  geo?: GeoPoint | null;
}

export const EMPTY_DRAFT: JournalDraft = { topic: "", kind: "ok", text: "", checked: [], images: [], captions: {}, recordings: [], test: null, fittings: [], at: null, stage: null, geo: null };

export function sanitizeDraft(defaults: JournalDraft, stored: unknown): JournalDraft {
  if (!stored || typeof stored !== "object") return defaults;
  const s = stored as Partial<JournalDraft>;
  // Pola wpisu czyści ta sama funkcja co w dzienniku i w kopii (`cleanEntryParts`); szkic nie odrzuca pustego wpisu.
  const parts = cleanEntryParts(s);
  return {
    topic: typeof s.topic === "string" ? s.topic.slice(0, 64) : "",
    kind: JOURNAL_KINDS.includes(s.kind as JournalKind) ? (s.kind as JournalKind) : "ok",
    text: parts.text,
    checked: parts.checked,
    images: parts.images,
    captions: parts.captions,
    recordings: parts.recordings,
    test: parts.test,
    fittings: parts.fittings,
    at: typeof s.at === "number" && Number.isFinite(s.at) ? s.at : null,
    stage: parts.stage ?? null,
    geo: parts.geo ?? null,
  };
}

const store = createPersistedStore<JournalDraft>(JOURNAL_DRAFT_KEY, EMPTY_DRAFT, { merge: sanitizeDraft });

export const useJournalDraft = () => store.use();
export const getJournalDraft = () => store.get();

/** Szkic ma treść (tekst, zdjęcia, nagrania, odhaczenia, próba albo kształtki) — „Dokończ wpis” zamiast „Wpis”. */
export function draftHasContent(d: JournalDraft): boolean {
  return !!d.text.trim() || d.images.length > 0 || d.recordings.length > 0 || d.checked.length > 0 || d.test !== null || d.fittings.length > 0;
}

/** Samo „czy jest szkic” — pisanie w arkuszu nie przerysowuje dziennika, bo wartość zmienia się tylko na granicy pusty/niepusty. */
export const useHasJournalDraft = () => useSyncExternalStore(store.subscribe, () => draftHasContent(store.get()));

export function patchJournalDraft(patch: Partial<JournalDraft>) {
  store.set({ ...store.get(), ...patch });
}

/** Inny temat = inna lista kontrolna, więc zaznaczone punkty się zerują; tekst i zdjęcia zostają. */
export function setJournalDraftTopic(topic: string) {
  if (topic === store.get().topic) return;
  patchJournalDraft({ topic, checked: [] });
}

/** Po zapisie wpisu: rodzaj i temat zostają (kolejny wpis zwykle dotyczy tego samego). */
export function clearJournalDraft() {
  const { topic, kind } = store.get();
  store.set({ ...EMPTY_DRAFT, topic, kind });
}
