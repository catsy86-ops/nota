import type { Note } from "@/hooks/useNotes";
import { nextOccurrence } from "@/lib/reminderRepeat";

/**
 * Które przypomnienia odpalić przy tym sprawdzeniu. Czysta funkcja: bez zegara,
 * bez DOM i bez zapisu — hook (`useReminderNotifications`) wykonuje efekty.
 *
 * Seria zaległa o kilka cykli (np. aplikacja była zamknięta przez tydzień) daje
 * JEDEN krok: odpala raz, liczy pominięte wystąpienia i przesuwa termin na
 * najbliższy przyszły. Dawniej każdy zaległy cykl dostawał osobny dymek, bo hook
 * przesuwał termin tylko o jeden krok po każdym odpaleniu.
 */

export interface DueStep {
  note: Note;
  /** Jednorazowe („nigdy”) trafiają do rejestru „już odpalone”, serie dostają `next`. */
  kind: "once" | "series";
  /** Serie: najbliższy wystąpienie w przyszłości; `null` = seria się skończyła. Jednorazowe: `null`. */
  next: number | null;
  /** Serie: ile zaległych wystąpień po tym, które odpala teraz (0 = na czas). */
  missed: number;
}

/** Zabezpieczenie przed nieskończoną pętlą przy absurdalnie starym terminie (np. codziennie od 1970). */
const MAX_CATCH_UP = 1000;

/**
 * @param fired `reminder`-y po id, które już odpalono i nie wolno odpalić drugi raz (rejestr `firedReminders`).
 * @param handled id → wartość `reminder`, dla której krok już wykonano (zabezpiecza przed podwójnym odpaleniem,
 *   gdy zapis przesunięcia jeszcze nie dotarł do listy notatek).
 */
export function planDueReminders(
  notes: readonly Note[],
  fired: ReadonlySet<string>,
  now: number,
  handled: ReadonlyMap<string, number> = new Map(),
): DueStep[] {
  const steps: DueStep[] = [];
  for (const note of notes) {
    if (!note.reminder || note.reminder > now) continue;
    if (fired.has(note.id)) continue;
    if (handled.get(note.id) === note.reminder) continue;

    const repeat = note.reminderRepeat ?? "none";
    if (repeat === "none") {
      steps.push({ note, kind: "once", next: null, missed: 0 });
      continue;
    }

    let cur = note.reminder;
    // Odłożone wystąpienie: następny jest od terminu serii, nie od odłożonej chwili.
    let next = nextOccurrence(note, cur);
    let missed = 0;
    // Nadganianie: kolejne wystąpienia już minęły — liczymy je, zamiast odpalać każde osobno.
    while (next !== null && next <= now && missed < MAX_CATCH_UP) {
      cur = next;
      missed++;
      next = nextOccurrence(note, cur);
    }
    steps.push({ note, kind: "series", next, missed });
  }
  return steps;
}
