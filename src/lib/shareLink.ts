import type { ChecklistItem, NoteColor } from "@/hooks/useNotes";
import { NOTE_COLORS, safeBool, safeEnum, safeString, safeStringArray } from "@/lib/safeProjection";

/**
 * Link „?share=…” niesie całą notatkę w adresie. Adres jest wejściem z zewnątrz
 * (każdy może wysłać link), więc wynik dekodowania jest walidowany tak jak
 * import pliku: zły typ pola = wartość domyślna, rozmiary obcięte.
 */

export const SHARE_PARAM_MAX_CHARS = 200_000;
const MAX_TITLE = 1_000;
const MAX_CONTENT = 100_000;
const MAX_LABELS = 50;
const MAX_LABEL = 100;
const MAX_CHECKLIST = 500;
const MAX_ITEM = 2_000;

export interface SharedLink {
  title: string;
  content: string;
  color: NoteColor;
  labels: string[];
  checklist: ChecklistItem[];
}

export interface ShareSource {
  title: string;
  content: string;
  checklist: ChecklistItem[];
  labels: string[];
  color: NoteColor;
}

export function encodeShareParam(note: ShareSource): string {
  const data = { t: note.title, c: note.content, cl: note.checklist, l: note.labels, co: note.color };
  return btoa(encodeURIComponent(JSON.stringify(data)));
}

/** Zwraca zwalidowaną notatkę albo `null`, gdy parametr nie jest poprawnym udostępnieniem. */
export function parseShareParam(raw: string): SharedLink | null {
  if (!raw || raw.length > SHARE_PARAM_MAX_CHARS) return null;
  let data: unknown;
  try {
    data = JSON.parse(decodeURIComponent(atob(raw)));
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const checklist: ChecklistItem[] = [];
  if (Array.isArray(d.cl)) {
    for (const item of d.cl) {
      if (checklist.length >= MAX_CHECKLIST) break;
      if (!item || typeof item !== "object") continue;
      const i = item as Record<string, unknown>;
      checklist.push({
        id: typeof i.id === "string" && i.id && i.id.length <= 100 ? i.id : crypto.randomUUID(),
        text: safeString(i.text, "", MAX_ITEM),
        checked: safeBool(i.checked),
      });
    }
  }
  return {
    title: safeString(d.t, "", MAX_TITLE),
    content: safeString(d.c, "", MAX_CONTENT),
    color: safeEnum(d.co, NOTE_COLORS, "default"),
    labels: safeStringArray(d.l, MAX_LABELS, MAX_LABEL),
    checklist,
  };
}
