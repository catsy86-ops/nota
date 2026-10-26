export type ReminderRepeat = "none" | "daily" | "weekly" | "monthly";

export const REMINDER_REPEAT_LABELS: Record<ReminderRepeat, string> = {
  none: "Nigdy",
  daily: "Codziennie",
  weekly: "Co tydzień",
  monthly: "Co miesiąc",
};

/**
 * Zwraca timestamp kolejnego wystąpienia przypomnienia, zachowując tę samą godzinę/minutę.
 *
 * `monthly`: dzień `anchorDay` (albo dzień `current`), a gdy miesiąc jest krótszy —
 * jego ostatni dzień. 31 stycznia → 28/29 lutego → 31 marca. Dawniej `setMonth`
 * przepełniał datę: 31 stycznia → 3 marca.
 */
export function getNextReminderTime(current: number, repeat: ReminderRepeat, anchorDay?: number, anchorMinutes?: number): number {
  const d = new Date(current);
  switch (repeat) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly": {
      const day = anchorDay ?? d.getDate();
      d.setDate(1); // najpierw 1., żeby zmiana miesiąca nie przepełniła daty
      d.setMonth(d.getMonth() + 1);
      d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())));
      break;
    }
    case "none":
    default:
      return current;
  }
  // Godzina serii jest z zapisu, nie z poprzedniego wystąpienia: po przeskoku czasu (2:30 → 3:30) następne wraca na 2:30 (T 1.2).
  if (anchorMinutes !== undefined) d.setHours(Math.floor(anchorMinutes / 60), anchorMinutes % 60, 0, 0);
  return d.getTime();
}

/**
 * Następny termin serii albo `null`, gdy wypadłby po końcu serii (`until`).
 * Jedyne miejsce, które decyduje, czy seria jeszcze trwa — powiadomienia,
 * kalendarz i „pomiń” liczą to samo.
 */
export function nextInSeries(current: number, repeat: ReminderRepeat, anchorDay?: number, until?: number, anchorMinutes?: number): number | null {
  const next = getNextReminderTime(current, repeat, anchorDay, anchorMinutes);
  return until !== undefined && next > until ? null : next;
}

/**
 * Następne wystąpienie serii po `at`. Gdy `at` to odłożone wystąpienie (`reminder` z `reminderBase`),
 * kolejny jest liczony od terminu serii, nie od chwili odłożenia — odłożenie nie przesuwa serii.
 */
export function nextOccurrence(
  note: { reminder: number | null; reminderRepeat?: ReminderRepeat; reminderDay?: number; reminderRepeatUntil?: number; reminderBase?: number; reminderTime?: number },
  at: number,
): number | null {
  const repeat = note.reminderRepeat ?? "none";
  if (repeat === "none") return null;
  const from = note.reminderBase !== undefined && at === note.reminder ? note.reminderBase : at;
  return nextInSeries(from, repeat, seriesDay(note), note.reminderRepeatUntil, seriesMinutes(note));
}

/**
 * Nowy zapis po odłożeniu wystąpienia do `at` (`reminder` + `reminderBase`). Seria jednorazowa — zwykły termin.
 * Seria: odłożona chwila zawsze wypada przed kolejnym terminem serii; gdyby nie, to kolejny termin zastępuje odłożenie
 * (przypomnienie nie wypada dwa razy). Seria, która się skończyła, zostawia odłożenie jako ostatni termin.
 */
export function snoozeTarget(
  note: { reminder: number | null; reminderRepeat?: ReminderRepeat; reminderDay?: number; reminderRepeatUntil?: number; reminderBase?: number; reminderTime?: number },
  at: number,
  now: number,
): { reminder: number; reminderBase: number | undefined } {
  const repeat = note.reminderRepeat ?? "none";
  if (repeat === "none") return { reminder: at, reminderBase: undefined };
  // Zaległe wystąpienia (aplikacja była zamknięta): odkładamy ostatnie, które już minęło, nie stary `reminder`.
  let base = note.reminderBase ?? note.reminder ?? at;
  let seriesNext = nextInSeries(base, repeat, seriesDay(note), note.reminderRepeatUntil, seriesMinutes(note));
  for (let i = 0; seriesNext !== null && seriesNext <= now && i < MAX_SERIES_STEPS; i++) {
    base = seriesNext;
    seriesNext = nextInSeries(base, repeat, seriesDay(note), note.reminderRepeatUntil, seriesMinutes(note));
  }
  if (seriesNext === null || at < seriesNext) return { reminder: at, reminderBase: base };
  return { reminder: seriesNext, reminderBase: undefined };
}

/**
 * „Gotowe” na przypomnieniu: nowy termin to następne wystąpienie serii, które jeszcze nie minęło
 * (zaległe pomijamy, jak przy odpaleniu). `null` = seria jednorazowa albo już się skończyła.
 */
export function doneTarget(
  note: { reminder: number | null; reminderRepeat?: ReminderRepeat; reminderDay?: number; reminderRepeatUntil?: number; reminderBase?: number; reminderTime?: number },
  now: number,
): number | null {
  const repeat = note.reminderRepeat ?? "none";
  if (note.reminder === null || repeat === "none") return null;
  let next = nextOccurrence(note, note.reminder);
  for (let i = 0; next !== null && next <= now && i < MAX_SERIES_STEPS; i++) {
    next = nextInSeries(next, repeat, seriesDay(note), note.reminderRepeatUntil, seriesMinutes(note));
  }
  return next;
}

/** Zabezpieczenie pętli przy bardzo starym terminie (jak `MAX_CATCH_UP` w `reminderDue.ts`). */
const MAX_SERIES_STEPS = 1000;

/** Koniec wybranego dnia (czas lokalny) — wartość `reminderRepeatUntil`. */
export function endOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
}

/**
 * Dzień serii notatki. Notatki sprzed pola `reminderDay` (albo utworzone od razu
 * z terminem) go nie mają — wtedy dzień zapisanego terminu, zanim cokolwiek go przytnie.
 */
export function seriesDay(note: { reminder: number | null; reminderDay?: number; reminderBase?: number }): number | undefined {
  // Odłożone wystąpienie (`reminderBase`) trzyma dzień serii, a nie dzień odłożenia (T-1.4).
  const term = note.reminderBase ?? note.reminder;
  return note.reminderDay ?? (term !== null && term !== undefined ? new Date(term).getDate() : undefined);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Godzina serii w minutach od północy (T 1.2). Zapisana w notatce (`reminderTime`), żeby seria wracała
 * na tę samą godzinę po zmianie czasu. Notatki bez zapisu — godzina terminu bazowego, jak dotąd.
 */
export function seriesMinutes(note: { reminder: number | null; reminderBase?: number; reminderTime?: number }): number | undefined {
  if (note.reminderTime !== undefined) return note.reminderTime;
  const term = note.reminderBase ?? note.reminder;
  if (term === null || term === undefined) return undefined;
  const d = new Date(term);
  return d.getHours() * 60 + d.getMinutes();
}

/** Minuty od północy czasu lokalnego dla chwili `at`. */
export function minutesOfDay(at: number): number {
  const d = new Date(at);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Czy `at` to krok serii przesunięty przez zmianę czasu: w tym dniu zmienia się przesunięcie strefy
 * i godzina różni się od kotwicy dokładnie o godzinę (2:30 → 3:30). Taki krok nie zmienia kotwicy.
 */
export function isDstShiftedOccurrence(anchorMinutes: number, at: number): boolean {
  const d = new Date(at);
  const startOffset = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTimezoneOffset();
  const endOffset = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59).getTimezoneOffset();
  if (startOffset === endOffset) return false;
  return Math.abs(minutesOfDay(at) - anchorMinutes) === 60;
}
