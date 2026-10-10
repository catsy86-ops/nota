import type { Note } from "@/hooks/useNotes";

export type GroupBy = "none" | "date" | "label" | "folder";

export interface NoteGroup {
  /** Stabilny klucz grupy (też klucz stanu zwinięcia, po prefiksie `groupBy`). */
  key: string;
  label: string;
  notes: Note[];
}

export interface GroupOptions {
  /** „Teraz” — wstrzykiwane, żeby granice dni dało się testować. */
  now: number;
  /** Która data decyduje o przedziale (domyślnie ostatnia modyfikacja). */
  dateField?: "updatedAt" | "createdAt";
  folders?: { id: string; name: string }[];
}

export const DATE_GROUPS: { key: string; label: string }[] = [
  { key: "today", label: "Dzisiaj" },
  { key: "yesterday", label: "Wczoraj" },
  { key: "week", label: "Ten tydzień" },
  { key: "month", label: "Ten miesiąc" },
  { key: "older", label: "Starsze" },
];

/** Początek dnia (lokalnie) przesunięty o `dayOffset` dni — przez konstruktor, więc odporny na zmianę czasu. */
function startOfDay(now: number, dayOffset = 0): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dayOffset).getTime();
}

/** Początek tygodnia (poniedziałek, lokalnie). */
export function startOfWeek(now: number): number {
  const d = new Date(now);
  const sinceMonday = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday).getTime();
}

function startOfMonth(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** Przedział daty: dzisiaj → wczoraj → ten tydzień (od poniedziałku) → ten miesiąc → starsze. */
export function dateBucket(ts: number, now: number): string {
  if (ts >= startOfDay(now)) return "today"; // także „z przyszłości” (rozjazd zegarów)
  if (ts >= startOfDay(now, -1)) return "yesterday";
  if (ts >= startOfWeek(now)) return "week";
  if (ts >= startOfMonth(now)) return "month";
  return "older";
}

const collator = new Intl.Collator("pl", { sensitivity: "base" });

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * Dzieli (już posortowane) notatki na grupy, zachowując porządek wewnątrz grupy.
 * Notatka trafia do dokładnie jednej grupy — przy etykietach do pierwszej,
 * inaczej ta sama karta pojawiłaby się w kilku siatkach naraz.
 * Puste grupy są pomijane; `none` zwraca jedną grupę o pustym kluczu.
 */
export function groupNotes(notes: Note[], groupBy: GroupBy, opts: GroupOptions): NoteGroup[] {
  if (groupBy === "none") return notes.length ? [{ key: "", label: "", notes }] : [];

  if (groupBy === "date") {
    const field = opts.dateField ?? "updatedAt";
    const buckets = new Map<string, Note[]>();
    for (const n of notes) push(buckets, dateBucket(n[field], opts.now), n);
    return DATE_GROUPS.filter((g) => buckets.has(g.key)).map((g) => ({ key: g.key, label: g.label, notes: buckets.get(g.key)! }));
  }

  const buckets = new Map<string, Note[]>();
  const names = new Map<string, string>();
  const NONE = "none";
  for (const n of notes) {
    let k = NONE;
    if (groupBy === "label") {
      const first = n.labels[0];
      if (first) { k = first; names.set(k, first); }
    } else {
      const f = n.folderId ? opts.folders?.find((x) => x.id === n.folderId) : undefined;
      if (f) { k = f.id; names.set(k, f.name); }
    }
    push(buckets, k, n);
  }
  const noneLabel = groupBy === "label" ? "Bez etykiety" : "Bez folderu";
  const keys = [...buckets.keys()].filter((k) => k !== NONE).sort((a, b) => collator.compare(names.get(a)!, names.get(b)!));
  if (buckets.has(NONE)) keys.push(NONE);
  return keys.map((k) => ({
    key: k,
    label: k === NONE ? noneLabel : groupBy === "label" ? `#${names.get(k)}` : names.get(k)!,
    notes: buckets.get(k)!,
  }));
}
