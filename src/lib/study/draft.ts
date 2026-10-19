import { createPersistedStore } from "@/lib/persistedStore";
import { cleanFittings, type Fitting } from "./fittings";
import { cleanTest, type PressureTest } from "./pressureTest";
import { isImageRef } from "@/lib/imageStore";
import { JOURNAL_DRAFT_KEY } from "./keys";
import { cleanGeo, type GeoPoint } from "./geo";
import { cleanRecordings, JOURNAL_KINDS, JOURNAL_MAX_IMAGES, JOURNAL_MAX_TEXT, type JournalKind } from "./yStudy";
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

export const EMPTY_DRAFT: JournalDraft = { topic: "", kind: "ok", text: "", checked: [], images: [], recordings: [], test: null, fittings: [], at: null, stage: null, geo: null };

export function sanitizeDraft(defaults: JournalDraft, stored: unknown): JournalDraft {
  if (!stored || typeof stored !== "object") return defaults;
  const s = stored as Partial<JournalDraft>;
  return {
    topic: typeof s.topic === "string" ? s.topic.slice(0, 64) : "",
    kind: JOURNAL_KINDS.includes(s.kind as JournalKind) ? (s.kind as JournalKind) : "ok",
    text: typeof s.text === "string" ? s.text.slice(0, JOURNAL_MAX_TEXT) : "",
    checked: Array.isArray(s.checked) ? s.checked.filter((id): id is string => typeof id === "string").slice(0, 60) : [],
    images: Array.isArray(s.images) ? s.images.filter((r): r is string => typeof r === "string" && isImageRef(r)).slice(0, JOURNAL_MAX_IMAGES) : [],
    recordings: cleanRecordings(s.recordings),
    test: cleanTest(s.test),
    fittings: cleanFittings(s.fittings),
    at: typeof s.at === "number" && Number.isFinite(s.at) ? s.at : null,
    stage: typeof s.stage === "string" && s.stage && s.stage.length <= 40 ? s.stage : null,
    geo: cleanGeo(s.geo) ?? null,
  };
}

const store = createPersistedStore<JournalDraft>(JOURNAL_DRAFT_KEY, EMPTY_DRAFT, { merge: sanitizeDraft });

export const useJournalDraft = () => store.use();
export const getJournalDraft = () => store.get();

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
