import type { Note } from "@/hooks/useNotes";

/**
 * Wcześniejsze przypomnienie (Terminy 3.2): drugi sygnał `reminderLead` minut przed terminem.
 * Termin dalej dzwoni o swojej porze; tu tylko „Za godzinę: …” wcześniej.
 *
 * Sygnał nie odpala się, gdy notatkę zmieniono już po jego chwili (`updatedAt`): ustawienie terminu
 * „za 30 min” z sygnałem „1 h wcześniej” albo odłożenie o 10 minut nie wyrzuca od razu „Za 10 min”.
 * Minuta zapasu (`UPDATE_GRACE_MS`): seria przesuwa się na następny termin kilka sekund po bieżącym, a przy
 * sygnale równym odstępowi serii (codziennie + „Dzień”) to dokładnie chwila następnego sygnału.
 * Odłożone wystąpienie serii (`reminderBase`) też go nie ma — sygnał był przed pierwotnym terminem.
 */

export const LEAD_OPTIONS = [
  { min: 15, label: "15 min" },
  { min: 60, label: "1 h" },
  { min: 1440, label: "Dzień" },
] as const;

/** Do tygodnia wcześniej; peer może wpisać cokolwiek, więc odczyt to sprawdza. */
export const LEAD_MAX_MIN = 7 * 1440;

export function isLeadMinutes(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= LEAD_MAX_MIN;
}

/** Początek dymku: „Za 15 min”, „Za godzinę”, „Za 3 h”, „Jutro o tej porze”, „Za 2 dni”. */
export function leadPhrase(min: number): string {
  if (min < 60) return `Za ${min} min`;
  if (min === 60) return "Za godzinę";
  if (min < 1440) return `Za ${Math.round(min / 60)} h`;
  if (min === 1440) return "Jutro o tej porze";
  return `Za ${Math.round(min / 1440)} dni`;
}

/** Krótko w podglądzie pickera: „15 min wcześniej”, „dzień wcześniej”. */
export function leadShort(min: number): string {
  if (min < 60) return `${min} min wcześniej`;
  if (min < 1440) return `${Math.round(min / 60)} h wcześniej`;
  if (min === 1440) return "dzień wcześniej";
  return `${Math.round(min / 1440)} dni wcześniej`;
}

const UPDATE_GRACE_MS = 60_000;

type LeadNote = Pick<Note, "id" | "reminder" | "reminderLead" | "reminderBase" | "updatedAt">;

/** Chwila wcześniejszego sygnału dla terminu `at` (domyślnie bieżącego) albo `null`. */
export function leadAt(note: Pick<Note, "reminder" | "reminderLead" | "reminderBase">, at: number | null = note.reminder): number | null {
  if (!at || !isLeadMinutes(note.reminderLead) || note.reminderBase !== undefined) return null;
  return at - note.reminderLead * 60_000;
}

export const leadKey = (id: string, reminder: number) => `${id}:${reminder}`;

/** Notatki, którym teraz należy się wcześniejszy sygnał: jego chwila minęła, termin jeszcze nie. */
export function planLeadReminders<N extends LeadNote>(notes: readonly N[], fired: ReadonlySet<string>, now: number): N[] {
  const out: N[] = [];
  for (const n of notes) {
    const at = leadAt(n);
    if (at === null || at > now || n.reminder! <= now) continue;
    if (n.updatedAt > at + UPDATE_GRACE_MS) continue;
    if (fired.has(leadKey(n.id, n.reminder!))) continue;
    out.push(n);
  }
  return out;
}

const LEADS_KEY = "kaczy.reminderLeads.v1";

export function loadFiredLeads(): Set<string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(LEADS_KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

/**
 * Usuwa wpisy po terminach, które już minęły (termin jest w kluczu), żeby zbiór nie rósł,
 * i zapisuje — tylko gdy coś się zmieniło (`added` albo usunięte wpisy), nie przy każdym tyknięciu.
 * Celowo bez listy notatek: tuż po starcie jest pusta (IndexedDB jeszcze się wczytuje) i wyczyściłaby
 * wszystko — sygnał wróciłby po każdym przeładowaniu.
 */
export function saveFiredLeads(fired: Set<string>, now: number, added = false): void {
  let changed = added;
  for (const k of fired) {
    const at = Number(k.slice(k.lastIndexOf(":") + 1));
    if (!Number.isFinite(at) || at <= now) { fired.delete(k); changed = true; }
  }
  if (!changed) return;
  try {
    localStorage.setItem(LEADS_KEY, JSON.stringify([...fired]));
  } catch {
    // Brak miejsca: najwyżej sygnał powtórzy się po przeładowaniu.
  }
}
