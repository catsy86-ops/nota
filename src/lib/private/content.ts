import type { Note, ChecklistItem } from "@/lib/types/note";
import { logDiag } from "@/lib/diagnostics";
import { NOTE_COLORS } from "@/lib/safeProjection";
import { VaultError } from "@/lib/vault";

/**
 * Treść notatki prywatnej w szyfrogramie (A3.3, wydzielone z `privateNotes.ts` bez zmiany formatu): kształt,
 * odczyt z JSON-u po odszyfrowaniu, metadane (V-3, krok 3) i pola z przyszłych wersji (C-14). Czyste funkcje.
 */

export type PrivateMeta = Partial<Pick<Note, "color" | "folderId" | "parentId" | "icon">>;

export interface PrivateContent {
  title: string;
  content: string;
  checklist: ChecklistItem[];
  labels: string[];
  /** Metadane notatki w szyfrogramie (V-3, krok 3); brak w starszych treściach = metadane w dokumencie. */
  meta?: PrivateMeta;
}

/** Metadane notatki do szyfrogramu (krok 3): tylko te, które notatka ma. */
export function privateMetaOf(n: Partial<Pick<Note, "color" | "folderId" | "parentId" | "icon">>): PrivateMeta | undefined {
  const meta: PrivateMeta = {};
  if (n.color !== undefined) meta.color = n.color;
  if (n.folderId !== undefined) meta.folderId = n.folderId;
  if (n.parentId !== undefined) meta.parentId = n.parentId;
  if (n.icon !== undefined) meta.icon = n.icon;
  return Object.keys(meta).length ? meta : undefined;
}

/** Metadane z treści szyfrogramu: tylko znane pola we właściwych typach; brak pól = undefined. */
export function cleanPrivateMeta(raw: unknown): PrivateMeta | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const meta: PrivateMeta = {};
  if (typeof r.color === "string" && (NOTE_COLORS as readonly string[]).includes(r.color)) meta.color = r.color as Note["color"];
  if (r.folderId === null || (typeof r.folderId === "string" && r.folderId.length <= 200)) meta.folderId = r.folderId as string | null;
  if (typeof r.parentId === "string" && r.parentId.length <= 200) meta.parentId = r.parentId;
  if (typeof r.icon === "string" && r.icon.length <= 32) meta.icon = r.icon;
  return Object.keys(meta).length ? meta : undefined;
}

const KNOWN_CONTENT_KEYS = new Set(["title", "content", "checklist", "labels", "meta"]);
const MAX_EXTRA_JSON = 64 * 1024;

/**
 * Widok treści bez pól z przyszłości (przegląd K0 cz. 2): karta składa `{ ...note, ...content }`, więc nieznane pole
 * (np. `id`, `images`) nadpisałoby pola notatki. Pola zostają w pamięci podręcznej i wracają przy zapisie.
 * Ten sam obiekt dla tej samej treści — `useMemo` w karcie nie liczy się od nowa.
 */
const knownView = new WeakMap<PrivateContent, PrivateContent>();
export function knownContent(c: PrivateContent | undefined): PrivateContent | undefined {
  if (!c) return undefined;
  if (Object.keys(c).every((k) => KNOWN_CONTENT_KEYS.has(k))) return c;
  let v = knownView.get(c);
  if (!v) {
    v = { title: c.title, content: c.content, checklist: c.checklist, labels: c.labels, ...(c.meta ? { meta: c.meta } : {}) };
    knownView.set(c, v);
  }
  return v;
}

export function parseContent(json: string): PrivateContent {
  const raw = JSON.parse(json) as Partial<PrivateContent> | null;
  if (!raw || typeof raw !== "object") throw new VaultError("bad-format");
  const checklist = Array.isArray(raw.checklist)
    ? raw.checklist
      .filter((i): i is ChecklistItem => !!i && typeof i === "object" && typeof (i as ChecklistItem).id === "string")
      .map((i) => ({ id: i.id, text: typeof i.text === "string" ? i.text : "", checked: Boolean(i.checked), ...(i.indent === 1 ? { indent: 1 as const } : {}) }))
    : [];
  const meta = cleanPrivateMeta(raw.meta);
  // C-14 (K0 cz. 2): pola z przyszłych wersji przechodzą bez zmian, żeby zapis starszej wersji ich nie skasował.
  let extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) if (!KNOWN_CONTENT_KEYS.has(k) && k !== "__proto__") extra[k] = v;
  if (Object.keys(extra).length && JSON.stringify(extra).length > MAX_EXTRA_JSON) {
    logDiag("warn", "privateNotes", "unknown fields in a private note exceed 64 KB — dropped");
    extra = {};
  }
  return {
    ...extra,
    title: typeof raw.title === "string" ? raw.title : "",
    content: typeof raw.content === "string" ? raw.content : "",
    checklist,
    labels: Array.isArray(raw.labels) ? raw.labels.filter((l): l is string => typeof l === "string") : [],
    ...(meta ? { meta } : {}),
  };
}

/** Nieznane pola treści (C-14) jako JSON do zachowania przy zdjęciu blokady; za duże albo brak — `undefined`. */
export function futureFieldsJson(c: PrivateContent): string | undefined {
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c)) if (!KNOWN_CONTENT_KEYS.has(k)) extra[k] = v;
  if (!Object.keys(extra).length) return undefined;
  const json = JSON.stringify(extra);
  return json.length <= MAX_EXTRA_JSON ? json : undefined;
}

/** Odwrotność `futureFieldsJson` przy ponownej blokadzie: tylko nieznane klucze, bez `__proto__`. */
export function parseFutureFields(json: string | null): Record<string, unknown> {
  if (!json || json.length > MAX_EXTRA_JSON) return {};
  try {
    const raw = JSON.parse(json) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) if (!KNOWN_CONTENT_KEYS.has(k) && k !== "__proto__") out[k] = v;
    return out;
  } catch { return {}; }
}
