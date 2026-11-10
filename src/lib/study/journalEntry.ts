import { cleanFittings, type Fitting } from "./fittings";
import { cleanAuthor } from "./companyPrefs";
import { cleanPipes, type Pipe } from "./pipes";
import { isImageRef } from "@/lib/imageStore";
import type { Attachment } from "@/lib/attachments";
import { cleanTest, type PressureTest } from "./pressureTest";
import { cleanGeo, type GeoPoint } from "./geo";

/**
 * Wpis dziennika z budowy jako czyste dane: typ, limity i czyszczenie z dowolnego wejścia
 * (arkusz, kopia, drugi telefon, projekcja). Bez `yjs` i bez materiału (`content.ts`) —
 * moduł jest w paczce startowej razem z `yStudy.ts`, który go re-eksportuje (H0.2).
 */

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
  /** Podpisy zdjęć (klucz = ref ze `images`, tekst ≤ 80 znaków). Wypalane w pliku dopiero przy eksporcie (P-1). */
  captions?: Record<string, string>;
  /**
   * Rysunek na zdjęciu (H0.1): ref narysowanego zdjęcia z `images` → ref oryginału. Oryginał zostaje
   * w `imageStore` (nie jest odśmiecany), a „Cofnij rysunek” wstawia go z powrotem.
   */
  drawnFrom?: Record<string, string>;
  /** B3.3: wymiary na zdjęciach (miarka); klucz = ref zdjęcia, wartość = wymiary (od/do pkt i tekst). */
  dimensions?: Record<string, Array<{ from: [number, number]; to: [number, number]; text: string }>>;
  /** B3.4: poziomnica — kąt nachylenia rury w stopniach (może być ujemny). */
  level?: number;
  /** Zdjęcia z budowy: klucze z `imageStore` (bajty poza stanem Nauki). */
  images: string[];
  /** Nagrania głosowe z budowy (załączniki audio; bajty w `imageStore`). Brak = bez nagrań. */
  recordings?: Attachment[];
  /** Problem rozwiązany — moment rozwiązania (ms); brak = otwarty. Tylko dla `problem`. */
  resolved?: number;
  /** Jak problem rozwiązano („wymieniona złączka”) — baza własnych rozwiązań. Tylko dla `problem`. */
  solution?: string;
  /** Usterka (P2.3): kto odpowiada za naprawę. Tylko dla `problem`. */
  owner?: string;
  /** Usterka (P2.3): termin naprawy (`YYYY-MM-DD`). Tylko dla `problem`. */
  due?: string;
  /** Usterka (P2.3): zdjęcia po naprawie (klucze z `imageStore`); `images` to zdjęcia przed. Tylko dla `problem`. */
  after?: string[];
  /** Protokół próby szczelności (`pressureTest.ts`); brak = wpis bez próby. */
  test?: PressureTest;
  /** Zużyte kształtki (`fittings.ts`); brak = bez kształtek. */
  fittings?: Fitting[];
  /** Zużyte rury w centymetrach (`pipes.ts`, H1.1); brak = bez rur. Starsza wersja pole pomija. */
  pipes?: Pipe[];
  /** Etap budowy (id z listy karty, `stages.ts`), który ten wpis zamknął — zdjęcia idą do protokołu przy etapie. */
  stage?: string;
  /** „Tu jestem”: gdzie zapisano wpis (`geo.ts`); tylko po stuknięciu, nie trafia do raportu. */
  geo?: GeoPoint;
  /** Punkt w pomieszczeniu (`points.ts`, id), którego dotyczy zdjęcie wpisu (H2.3); brak = bez punktu. */
  point?: string;
  /** H5.1: kto zapisał wpis (imię z urządzenia, `companyPrefs.ts`); brak = nie ustawiono. */
  by?: string;
  /** H1.3: materiał z wpisu przyszedł dostawą na budowę, nie z auta; brak = z auta (decyzja H-1). */
  supply?: "site";
}

/**
 * Ile zdjęć mieści jeden wpis (decyzja 2026-10-15: 5 — seria „przed zakryciem”).
 * Starsza wersja aplikacji (limit 4) pokaże 4, a przy edycji wpisu piąte zgubi.
 */
export const JOURNAL_MAX_IMAGES = 5;
/** Nagrania w jednym wpisie (U8: osobny załącznik, nie zdjęcie). */
export const JOURNAL_MAX_RECORDINGS = 3;
export const JOURNAL_MAX_TEXT = 2000;
/** Opis rozwiązania problemu — krótki, jedno-dwa zdania. */
export const JOURNAL_SOLUTION_MAX = 500;
/** Usterka (P2.3): najdłuższa nazwa odpowiedzialnego i liczba zdjęć po naprawie. */
export const FAULT_OWNER_MAX = 60;
export const FAULT_AFTER_MAX = 20;
export const SITE_MAX = 120;

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Część wpisu wspólna dla zapisu, kopii i projekcji: tekst, odhaczenia (id, bez sprawdzania
 * materiału), zdjęcia, próba, kształtki, etap, lokalizacja. `empty` = nic w tym nie ma
 * (sprawdzane przed filtrem materiału — wpis z odhaczeniami, których punkt zniknął, zostaje).
 */
export function cleanEntryParts(e: { text?: unknown; checked?: unknown; images?: unknown; captions?: unknown; drawnFrom?: unknown; dimensions?: unknown; level?: unknown; recordings?: unknown; test?: unknown; fittings?: unknown; pipes?: unknown; stage?: unknown; geo?: unknown }) {
  const text = typeof e.text === "string" ? e.text.slice(0, JOURNAL_MAX_TEXT) : "";
  const checked = Array.isArray(e.checked) ? e.checked.filter((id): id is string => typeof id === "string" && id.length <= 64).slice(0, 60) : [];
  const images = Array.isArray(e.images) ? e.images.filter((r): r is string => typeof r === "string" && isImageRef(r)).slice(0, JOURNAL_MAX_IMAGES) : [];
  const captions = cleanCaptions(e.captions, images);
  const drawnFrom = cleanDrawnFrom(e.drawnFrom, images);
  const dimensions = cleanDimensions(e.dimensions, images);
  const level = typeof e.level === "number" && Number.isFinite(e.level) ? Math.round(e.level * 100) / 100 : undefined;
  const recordings = cleanRecordings(e.recordings);
  const test = cleanTest(e.test);
  const fittings = cleanFittings(e.fittings);
  const pipes = cleanPipes(e.pipes);
  const stage = cleanEntryStage(e.stage);
  const geo = cleanGeo(e.geo);
  const empty = !text.trim() && checked.length === 0 && images.length === 0 && recordings.length === 0 && !test && fittings.length === 0 && pipes.length === 0 && !stage;
  return { text, checked, images, captions, drawnFrom, dimensions, level, recordings, test, fittings, pipes, stage, geo, empty };
}

/**
 * Nagrania wpisu z dowolnego wejścia (dokument, kopia, peer): tylko poprawne manifesty audio.
 * Hash to klucz w `imageStore`; rozmiar i typ muszą mieścić się w zapisanych wartościach.
 */
export function cleanRecordings(raw: unknown): Attachment[] {
  if (!Array.isArray(raw)) return [];
  const out: Attachment[] = [];
  for (const r of raw) {
    const a = r as Partial<Attachment> | null;
    if (!a || typeof a !== "object") continue;
    if (typeof a.hash !== "string" || !isImageRef(a.hash)) continue;
    if (typeof a.name !== "string" || !a.name) continue;
    if (typeof a.size !== "number" || !Number.isFinite(a.size) || a.size <= 0) continue;
    if (typeof a.type !== "string" || !a.type.startsWith("audio/")) continue;
    out.push({ hash: a.hash, name: a.name.slice(0, 120), size: a.size, type: a.type });
    if (out.length >= JOURNAL_MAX_RECORDINGS) break;
  }
  return out;
}

/** Kształt wpisu (bez sprawdzania materiału); `null` = nie do uratowania. */
export function cleanEntry(raw: unknown): JournalEntry | null {
  const e = raw as Partial<JournalEntry> | null;
  if (!e || typeof e !== "object") return null;
  if (typeof e.id !== "string" || !e.id || e.id.length > 64) return null;
  if (typeof e.at !== "number" || !Number.isFinite(e.at)) return null;
  if (!JOURNAL_KINDS.includes(e.kind as JournalKind)) return null;
  const { text, checked, images, captions, drawnFrom, dimensions, level, recordings, test, fittings, pipes, stage, geo, empty } = cleanEntryParts(e);
  if (empty) return null;
  return {
    id: e.id, at: e.at, kind: e.kind as JournalKind,
    topic: typeof e.topic === "string" && e.topic.length <= 64 ? e.topic : null,
    text,
    site: typeof e.site === "string" ? e.site.slice(0, SITE_MAX) : "",
    ...(typeof e.siteId === "string" && e.siteId && e.siteId.length <= 64 ? { siteId: e.siteId } : {}),
    checked,
    images,
    ...(Object.keys(captions).length ? { captions } : {}),
    ...(Object.keys(drawnFrom).length ? { drawnFrom } : {}),
    ...(Object.keys(dimensions).length ? { dimensions } : {}),
    ...(level !== undefined ? { level } : {}),
    ...(recordings.length ? { recordings } : {}),
    ...(e.kind === "problem" && typeof e.resolved === "number" && Number.isFinite(e.resolved) ? { resolved: e.resolved } : {}),
    ...(e.kind === "problem" && typeof e.solution === "string" && e.solution.trim() ? { solution: e.solution.trim().slice(0, JOURNAL_SOLUTION_MAX) } : {}),
    ...(e.kind === "problem" && typeof e.owner === "string" && e.owner.trim() ? { owner: e.owner.trim().slice(0, FAULT_OWNER_MAX) } : {}),
    ...(e.kind === "problem" && typeof e.due === "string" && DAY_RE.test(e.due) ? { due: e.due } : {}),
    ...(e.kind === "problem" && Array.isArray(e.after) && e.after.length ? { after: e.after.filter((r): r is string => typeof r === "string" && isImageRef(r)).slice(0, FAULT_AFTER_MAX) } : {}),
    ...(test ? { test } : {}),
    ...(fittings.length ? { fittings } : {}),
    ...(pipes.length ? { pipes } : {}),
    ...(stage ? { stage } : {}),
    ...(geo ? { geo } : {}),
    ...(typeof e.point === "string" && e.point && e.point.length <= 64 ? { point: e.point } : {}),
    ...(cleanAuthor(e.by) ? { by: cleanAuthor(e.by) } : {}),
    ...(e.supply === "site" ? { supply: "site" as const } : {}),
  };
}

/** Id etapu przy wpisie; śmieci → brak. */
export const cleanEntryStage = (v: unknown): string | undefined => (typeof v === "string" && v && v.length <= 40 ? v : undefined);

/** Pola wpisu, które są uporządkowanymi listami `Y.Array` (wersja 2 kopii). */
export const ORDERED_ENTRY_LISTS = new Set<string>(["images", "fittings"]);
/**
 * Pola wpisu, które ta wersja zna. Przy zapisie kasujemy tylko te, których brak w `next`;
 * pola z nowszej wersji (nieznane tutaj) zostają, żeby stara edycja ich nie wycinała.
 */
export const JOURNAL_ENTRY_KEYS: ReadonlySet<string> = new Set([
  "id", "at", "kind", "topic", "text", "site", "siteId", "checked", "images", "captions", "drawnFrom", "dimensions", "level", "recordings",
  "resolved", "solution", "test", "fittings", "pipes", "stage", "geo", "owner", "due", "after", "point", "by", "supply",
]);

/** Oryginały narysowanych zdjęć (H0.1): tylko dla zdjęć ze `images`, oryginał to poprawny, inny klucz. */
export function cleanDrawnFrom(raw: unknown, images: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const ref of images) {
    const v = (raw as Record<string, unknown>)[ref];
    if (typeof v === "string" && v !== ref && isImageRef(v)) out[ref] = v;
  }
  return out;
}

/**
 * Podpisy zdjęć wpisu (P-1): tylko dla zdjęć, które są we wpisie, tekst przycięty do 80 znaków,
 * puste pomijane. Nieprawidłowe wpisy znikają po cichu, zdjęcie zostaje.
 */
export function cleanCaptions(raw: unknown, images: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const ref of images) {
    const v = (raw as Record<string, unknown>)[ref];
    if (typeof v !== "string") continue;
    const text = v.trim().replace(/\s+/g, " ").slice(0, 80);
    if (text) out[ref] = text;
  }
  return out;
}

/** B3.3: wymiary na zdjęciach (miarka); tylko dla zdjęć ze `images`. */
export function cleanDimensions(raw: unknown, images: readonly string[]): Record<string, Array<{ from: [number, number]; to: [number, number]; text: string }>> {
  const out: Record<string, Array<{ from: [number, number]; to: [number, number]; text: string }>> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const ref of images) {
    const v = (raw as Record<string, unknown>)[ref];
    if (!Array.isArray(v)) continue;
    const dims: Array<{ from: [number, number]; to: [number, number]; text: string }> = [];
    for (const d of v) {
      const from = Array.isArray((d as any)?.from) && (d as any).from.length === 2 && (d as any).from.every((n: unknown) => typeof n === "number")
        ? [(d as any).from[0], (d as any).from[1]] as [number, number]
        : null;
      const to = Array.isArray((d as any)?.to) && (d as any).to.length === 2 && (d as any).to.every((n: unknown) => typeof n === "number")
        ? [(d as any).to[0], (d as any).to[1]] as [number, number]
        : null;
      const text = typeof (d as any)?.text === "string" ? String((d as any).text).slice(0, 80) : null;
      if (from && to && text) dims.push({ from, to, text });
    }
    if (dims.length) out[ref] = dims;
  }
  return out;
}
