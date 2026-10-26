import { nextOccurrence, ruleOf, type RepeatRule } from "@/lib/reminderRepeat";
import type { Note } from "@/hooks/useNotes";

/**
 * Rozwijanie przypomnień w wystąpienia na osi czasu — rdzeń widoku kalendarza.
 *
 * Model trzyma **jeden** timestamp na notatkę, a kolejny termin serii wylicza
 * się dopiero w chwili odpalenia (`useReminderNotifications`). Czyli naprawdę
 * istnieje wyłącznie najbliższe wystąpienie; wszystkie dalsze to prognoza
 * liczona tutaj w locie. Stąd `isNext` — UI musi umieć odróżnić termin, który
 * da się zapisać, od terminu, który jest tylko rysunkiem.
 */

export interface Occurrence {
  noteId: string;
  /** Moment wystąpienia. */
  at: number;
  /** Czy pochodzi z powtarzania (a nie z jednorazowego przypomnienia). */
  isSeries: boolean;
  /** Numer wystąpienia licząc od `note.reminder` (0 = to zapisane w modelu). */
  index: number;
  /**
   * Czy to jedyne wystąpienie realnie istniejące w danych. Tylko ono da się
   * edytować, przeciągnąć i usunąć — dalsze są prognozą.
   */
  isNext: boolean;
  /** Reguła powtarzania notatki (dni robocze, co N dni itd.); stare notatki mają zwykły rodzaj. */
  repeat: RepeatRule;
  /** Cały dzień: godzina 9:00 z flagi, nie z wyboru — oś dnia pokazuje takie terminy u góry, bez godziny. */
  allDay: boolean;
}

/**
 * Bezpiecznik na nieskończone serie: `daily` na zakresie kilku lat wygenerowałby
 * tysiące wystąpień. Miesiąc widoku to najwyżej ~31 wystąpień, więc zapas jest
 * ogromny, a pętla nie może się zapętlić na zawsze.
 */
const MAX_OCCURRENCES_PER_NOTE = 400;
/** Kroki przewijania do początku zakresu (bez zbierania wyników). Dzienna seria ~137 lat wstecz. */
const MAX_SKIP_STEPS = 50_000;

function isCandidate(note: Note): boolean {
  // Kosz nie należy do kalendarza; archiwum owszem — powiadomienia też je widzą.
  return !note.trashed && note.reminder !== null;
}

/**
 * Wystąpienia wszystkich przypomnień w przedziale `[rangeStart, rangeEnd]`.
 *
 * Wystąpień **przed** `note.reminder` nie ma: model nie zna historii serii,
 * więc kalendarz przewinięty wstecz pokazuje tylko to, co faktycznie zapisane.
 * Wynik jest posortowany rosnąco po czasie.
 */
export function expandOccurrences(notes: Note[], rangeStart: number, rangeEnd: number): Occurrence[] {
  const out: Occurrence[] = [];

  for (const note of notes) {
    if (!isCandidate(note)) continue;
    const start = note.reminder as number;
    const repeat = ruleOf(note);
    const allDay = note.reminderAllDay === true;

    if (repeat.kind === "none") {
      if (start >= rangeStart && start <= rangeEnd) {
        out.push({ noteId: note.id, at: start, isSeries: false, index: 0, isNext: true, repeat, allDay });
      }
      continue;
    }

    let at = start;
    let index = 0;
    // Najpierw przechodzimy bez zbierania do początku zakresu: seria zapisana dawno temu
    // nie może zużyć limitu wystąpień, zanim dojdzie do widoku (2g planu).
    for (; at < rangeStart && index < MAX_SKIP_STEPS; index++) {
      const next = nextOccurrence(note, at);
      if (next === null || next <= at) { at = Number.POSITIVE_INFINITY; break; }
      at = next;
    }
    for (let n = 0; n < MAX_OCCURRENCES_PER_NOTE; n++, index++) {
      if (at > rangeEnd) break;
      if (at >= rangeStart) {
        // Realny jest tylko zapisany termin; kolejne wystąpienia to prognoza.
        out.push({ noteId: note.id, at, isSeries: true, index, isNext: at === start, repeat, allDay });
      }
      const next = nextOccurrence(note, at);
      // Koniec serii albo nieruchomy krok — inaczej pętla stałaby w miejscu.
      if (next === null || next <= at) break;
      at = next;
    }
  }

  return out.sort((a, b) => a.at - b.at);
}

/** Klucz dnia w czasie **lokalnym** — kalendarz rysuje dni użytkownika, nie UTC. */
export function dayKey(at: number | Date): string {
  const d = at instanceof Date ? at : new Date(at);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Wystąpienia pogrupowane w dni, każdy dzień posortowany po godzinie. */
export function groupByDay(occurrences: Occurrence[]): Map<string, Occurrence[]> {
  const map = new Map<string, Occurrence[]>();
  for (const occ of occurrences) {
    const key = dayKey(occ.at);
    const bucket = map.get(key);
    if (bucket) bucket.push(occ);
    else map.set(key, [occ]);
  }
  for (const bucket of map.values()) bucket.sort((a, b) => a.at - b.at);
  return map;
}
