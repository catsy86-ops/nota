import type { ChecklistItem, NoteColor } from "@/lib/types/note";
import type { NotePriority } from "@/lib/notePriority";
import { fallbackRepeat, type ReminderRepeat, type RepeatRule } from "@/lib/reminderRepeat";
import { readRule } from "@/lib/reminderSpec";
import { PARKED_MAX, type Parked } from "@/lib/parkedDrafts";
import { NOTE_COLORS, PRIORITIES, REMINDER_REPEATS } from "@/lib/safeProjection";
import { POWLOKA } from "@/lib/storage/names";
import type { Attachment } from "@/lib/attachments";

/**
 * Szkic nowej notatki w kompozytorze (A3.2): kształt, sprawdzanie pól przy odczycie i zapis w localStorage
 * (`POWLOKA.draft` — bieżący szkic, `POWLOKA.drafts` — lista robocza „Odłóż”). Bez Reacta i DOM.
 */

const DRAFT_KEY = POWLOKA.draft;
const PARKED_KEY = POWLOKA.drafts;

export interface Draft {
  title: string;
  content: string;
  checklist: ChecklistItem[];
  /** Metadane szkicu: przywracane razem z tekstem, ale same nie czynią szkicu wartym zachowania. */
  color: NoteColor;
  labels: string[];
  reminder: number | null;
  reminderRepeat: ReminderRepeat;
  reminderRule?: RepeatRule;
  reminderRepeatUntil?: number;
  parentId?: string;
  priority: NotePriority;
}

const DRAFT_REPEATS: readonly ReminderRepeat[] = REMINDER_REPEATS;
const DRAFT_PRIORITIES: readonly NotePriority[] = PRIORITIES;

/** Szkic z dowolnego zapisu (localStorage, lista robocza): pola sprawdzone; `null`, gdy nie ma niczego wartego zachowania. */
export function sanitizeDraft(p: Partial<Draft>): Draft | null {
  const title = typeof p.title === "string" ? p.title : "";
  const content = typeof p.content === "string" ? p.content : "";
  const checklist = Array.isArray(p.checklist)
    ? p.checklist.filter((i): i is ChecklistItem => !!i && typeof i.id === "string" && typeof i.text === "string").map((i) => ({ id: i.id, text: i.text, checked: !!i.checked, ...(i.indent === 1 ? { indent: 1 as const } : {}) }))
    : [];
  if (!title.trim() && !content.trim() && !checklist.length) return null;
  const color = typeof p.color === "string" && (NOTE_COLORS as readonly string[]).includes(p.color) ? (p.color as NoteColor) : "default";
  const labels = Array.isArray(p.labels) ? p.labels.filter((l): l is string => typeof l === "string" && l.length > 0).slice(0, 20) : [];
  // Termin z przeszłości wystrzeliłby zaraz po zapisie — lepiej go nie przywracać.
  const reminder = typeof p.reminder === "number" && Number.isFinite(p.reminder) && p.reminder > Date.now() ? p.reminder : null;
  const priority = DRAFT_PRIORITIES.includes(p.priority as NotePriority) ? (p.priority as NotePriority) : "none";
  // Reguła z nowszej wersji (3.1) ma pierwszeństwo; zapasowy rodzaj z niej wynika.
  const rule = reminder !== null ? readRule(p.reminderRule) : undefined;
  const reminderRepeat = rule ? fallbackRepeat(rule) : reminder !== null && DRAFT_REPEATS.includes(p.reminderRepeat as ReminderRepeat) ? (p.reminderRepeat as ReminderRepeat) : "none";
  const until = typeof p.reminderRepeatUntil === "number" && Number.isFinite(p.reminderRepeatUntil) && reminderRepeat !== "none" ? p.reminderRepeatUntil : undefined;
  const parentId = typeof p.parentId === "string" && p.parentId.length > 0 && p.parentId.length <= 200 ? p.parentId : undefined;
  return { title, content, checklist, color, labels, reminder, reminderRepeat, reminderRule: rule, ...(until !== undefined ? { reminderRepeatUntil: until } : {}), ...(parentId ? { parentId } : {}), priority };
}

/** Szkic nowej notatki z poprzedniej sesji; `null`, gdy nie ma niczego wartego przywrócenia. */
export function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return sanitizeDraft(JSON.parse(raw) as Partial<Draft>);
  } catch { return null; }
}

/** Lista robocza z localStorage: każdy wpis przechodzi przez `sanitizeDraft`; uszkodzone pozycje odpadają. */
export function readParked(): Parked<Draft>[] {
  try {
    const raw = localStorage.getItem(PARKED_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    const out: Parked<Draft>[] = [];
    for (const e of list) {
      const x = e as { id?: unknown; at?: unknown; draft?: unknown } | null;
      if (!x || typeof x.id !== "string" || typeof x.at !== "number" || !x.draft || typeof x.draft !== "object") continue;
      const draft = sanitizeDraft(x.draft as Partial<Draft>);
      if (draft) out.push({ id: x.id, at: x.at, draft });
    }
    return out.slice(0, PARKED_MAX);
  } catch { return []; }
}

export function writeParked(list: Parked<Draft>[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(PARKED_KEY);
    else localStorage.setItem(PARKED_KEY, JSON.stringify(list));
  } catch { /* brak miejsca — lista robocza nie przeżyje przeładowania */ }
}

export function writeDraft(d: Draft): void {
  try {
    if (!d.title.trim() && !d.content.trim() && d.checklist.length === 0) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch { /* brak miejsca albo localStorage — szkic po prostu nie przeżyje przeładowania */ }
}

/** Szkic bez tekstu i bez pozycji listy — przy notatce prywatnej taki zapis usuwa ją, zamiast zostawić samą kłódkę. */
export function isTextEmpty(f: { title: string; content: string; checklist: readonly unknown[] }): boolean {
  return !f.title.trim() && !f.content.trim() && f.checklist.length === 0;
}

/** Usuwa bieżący szkic (po zapisie notatki albo odrzuceniu). */
export function clearDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* bez localStorage nie ma szkicu do usunięcia */ }
}

/** Pola kompozytora, które zeruje „wyczyść” i ładuje wznowienie szkicu. Zdjęcia, pliki i dodatki terminu nie idą do szkicu. */
export interface ComposerFields {
  title: string;
  content: string;
  checklist: ChecklistItem[];
  color: NoteColor;
  labels: string[];
  reminder: number | null;
  reminderRepeat: ReminderRepeat;
  reminderRule: RepeatRule | undefined;
  reminderUntil: number | undefined;
  /** 2.5: „Cały dzień” z wyboru terminu (termin 9:00 tego dnia, pokazywany jako sama data). */
  reminderAllDay: boolean;
  reminderLead: number | undefined;
  parentId: string | null;
  priority: NotePriority;
  images: string[];
  attachments: Attachment[];
}

export const EMPTY_FIELDS: ComposerFields = {
  title: "", content: "", checklist: [], color: "default", labels: [], reminder: null, reminderRepeat: "none",
  reminderRule: undefined, reminderUntil: undefined, reminderAllDay: false, reminderLead: undefined, parentId: null,
  priority: "none", images: [], attachments: [],
};

/** Pola z zapisanego szkicu (przy starcie albo wznowieniu z listy roboczej); `null` → pusty formularz. */
export function fieldsFromDraft(d: Draft | null): ComposerFields {
  if (!d) return EMPTY_FIELDS;
  return {
    ...EMPTY_FIELDS,
    title: d.title, content: d.content, checklist: d.checklist, color: d.color, labels: d.labels,
    reminder: d.reminder, reminderRepeat: d.reminderRepeat, reminderRule: d.reminderRule, reminderUntil: d.reminderRepeatUntil,
    parentId: d.parentId ?? null, priority: d.priority,
  };
}

/** Szkic do zapisu z pól kompozytora (bez zdjęć, plików i dodatków terminu). */
export function draftFromFields(f: ComposerFields): Draft {
  return {
    title: f.title, content: f.content, checklist: f.checklist, color: f.color, labels: f.labels,
    reminder: f.reminder, reminderRepeat: f.reminderRepeat, reminderRule: f.reminderRule,
    ...(f.reminderUntil !== undefined ? { reminderRepeatUntil: f.reminderUntil } : {}),
    ...(f.parentId ? { parentId: f.parentId } : {}),
    priority: f.priority,
  };
}

export type FieldsAction =
  | { [K in keyof ComposerFields]: { type: "set"; key: K; value: ComposerFields[K] | ((prev: ComposerFields[K]) => ComposerFields[K]) } }[keyof ComposerFields]
  | { type: "load"; draft: Draft }
  | { type: "reset" };

/** Reduktor pól szkicu: `set` przyjmuje wartość albo funkcję jak setter `useState`; `load` i `reset` zmieniają wszystko naraz. */
export function composerReducer(state: ComposerFields, action: FieldsAction): ComposerFields {
  switch (action.type) {
    case "reset": return EMPTY_FIELDS;
    case "load": return fieldsFromDraft(action.draft);
    case "set": {
      const prev = state[action.key];
      const value = typeof action.value === "function" ? (action.value as (p: typeof prev) => typeof prev)(prev) : action.value;
      return Object.is(value, prev) ? state : { ...state, [action.key]: value };
    }
  }
}
