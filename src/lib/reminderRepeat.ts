/** Rodzaje powtarzania, które zna każda wersja aplikacji (zapisywane w `reminderRepeat`). */
export type ReminderRepeat = "none" | "daily" | "weekly" | "monthly";

/**
 * Rodzaje z nowszych wersji (3.1). Zapisane w `reminderRule` (`reminderSpec`), a zapasowo w `reminderRepeat`
 * jako najbliższy znany rodzaj (`FALLBACK_REPEAT`), żeby starsza wersja przypomniała częściej, ale nie zgubiła terminu.
 */
export type RepeatKind = ReminderRepeat | "workdays" | "biweekly" | "yearly" | "weekdays" | "every";

/** Reguła powtarzania: rodzaj i jego parametry. `days` — dni tygodnia (0 = niedziela), `every` — co ile dni. */
export interface RepeatRule {
  kind: RepeatKind;
  days?: number[];
  every?: number;
}

export const REMINDER_REPEAT_LABELS: Record<ReminderRepeat, string> = {
  none: "Nigdy",
  daily: "Codziennie",
  weekly: "Co tydzień",
  monthly: "Co miesiąc",
};

export const REPEAT_KIND_LABELS: Record<RepeatKind, string> = {
  ...REMINDER_REPEAT_LABELS,
  workdays: "Dni robocze (pn–pt)",
  biweekly: "Co 2 tygodnie",
  yearly: "Co rok",
  weekdays: "Wybrane dni tygodnia",
  every: "Co N dni",
};

/** Najbliższy znany starszym wersjom rodzaj — zapisywany w `reminderRepeat` obok nowej reguły. */
const FALLBACK_REPEAT: Record<RepeatKind, ReminderRepeat> = {
  none: "none",
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
  workdays: "daily",
  biweekly: "weekly",
  yearly: "monthly",
  weekdays: "weekly",
  every: "daily",
};

export function fallbackRepeat(rule: RepeatRule): ReminderRepeat {
  return FALLBACK_REPEAT[rule.kind];
}

/** Reguła z rodzaju (starsze wywołania przekazują samo `ReminderRepeat`) albo z gotowej reguły. */
export function toRule(input: RepeatKind | RepeatRule | undefined): RepeatRule {
  if (input === undefined) return { kind: "none" };
  return typeof input === "string" ? { kind: input } : input;
}

/** Reguła notatki: nowsze pole `reminderRule`, a gdy go nie ma — stary `reminderRepeat`. */
export function ruleOf(note: { reminderRepeat?: ReminderRepeat; reminderRule?: RepeatRule }): RepeatRule {
  return note.reminderRule ?? { kind: note.reminderRepeat ?? "none" };
}

/** Dni tygodnia reguły w porządku rosnącym, bez powtórek i poza zakresem 0–6. */
export function weekdaysOf(rule: RepeatRule): number[] {
  const days = (rule.days ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return [...new Set(days)].sort((a, b) => a - b);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Ustawia godzinę serii (jak dotąd: z zapisu, nie z poprzedniego wystąpienia — T 1.2). */
function withAnchorTime(d: Date, anchorMinutes?: number): number {
  if (anchorMinutes !== undefined) d.setHours(Math.floor(anchorMinutes / 60), anchorMinutes % 60, 0, 0);
  return d.getTime();
}

/**
 * Zwraca timestamp kolejnego wystąpienia przypomnienia, zachowując tę samą godzinę/minutę.
 *
 * `monthly`: dzień `anchorDay` (albo dzień `current`), a gdy miesiąc jest krótszy —
 * jego ostatni dzień. 31 stycznia → 28/29 lutego → 31 marca. Dawniej `setMonth`
 * przepełniał datę: 31 stycznia → 3 marca. `yearly` działa tak samo, z 29 lutego → 28 lutego w zwykłym roku.
 */
export function getNextReminderTime(current: number, repeat: RepeatKind | RepeatRule, anchorDay?: number, anchorMinutes?: number): number {
  const rule = toRule(repeat);
  const d = new Date(current);
  switch (rule.kind) {
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
    case "workdays":
      // Następny dzień pn–pt (pomija sobotę i niedzielę).
      do d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6);
      break;
    case "biweekly":
      d.setDate(d.getDate() + 14);
      break;
    case "yearly": {
      const day = anchorDay ?? d.getDate();
      const month = d.getMonth();
      const year = d.getFullYear() + 1;
      d.setDate(1);
      d.setFullYear(year);
      d.setMonth(month);
      d.setDate(Math.min(day, daysInMonth(year, month)));
      break;
    }
    case "weekdays": {
      // Najbliższy dzień z wybranych dni tygodnia po bieżącym. Pusty wybór zachowuje się jak „co tydzień”.
      const days = weekdaysOf(rule);
      if (days.length === 0) { d.setDate(d.getDate() + 7); break; }
      for (let i = 0; i < 7; i++) {
        d.setDate(d.getDate() + 1);
        if (days.includes(d.getDay())) break;
      }
      break;
    }
    case "every":
      d.setDate(d.getDate() + Math.max(1, Math.round(rule.every ?? 1)));
      break;
    case "none":
    default:
      return current;
  }
  // Godzina serii jest z zapisu, nie z poprzedniego wystąpienia: po przeskoku czasu (2:30 → 3:30) następne wraca na 2:30 (T 1.2).
  return withAnchorTime(d, anchorMinutes);
}

/**
 * Następny termin serii albo `null`, gdy wypadłby po końcu serii (`until`).
 * Jedyne miejsce, które decyduje, czy seria jeszcze trwa — powiadomienia,
 * kalendarz i „pomiń” liczą to samo.
 */
export function nextInSeries(current: number, repeat: RepeatKind | RepeatRule, anchorDay?: number, until?: number, anchorMinutes?: number): number | null {
  const next = getNextReminderTime(current, repeat, anchorDay, anchorMinutes);
  return until !== undefined && next > until ? null : next;
}

/**
 * Następne wystąpienie serii po `at`. Gdy `at` to odłożone wystąpienie (`reminder` z `reminderBase`),
 * kolejny jest liczony od terminu serii, nie od chwili odłożenia — odłożenie nie przesuwa serii.
 */
export function nextOccurrence(
  note: { reminder: number | null; reminderRepeat?: ReminderRepeat; reminderRule?: RepeatRule; reminderDay?: number; reminderRepeatUntil?: number; reminderBase?: number; reminderTime?: number },
  at: number,
): number | null {
  const rule = ruleOf(note);
  if (rule.kind === "none") return null;
  const from = note.reminderBase !== undefined && at === note.reminder ? note.reminderBase : at;
  return nextInSeries(from, rule, seriesDay(note), note.reminderRepeatUntil, seriesMinutes(note));
}

/**
 * Nowy zapis po odłożeniu wystąpienia do `at` (`reminder` + `reminderBase`). Seria jednorazowa — zwykły termin.
 * Seria: odłożona chwila zawsze wypada przed kolejnym terminem serii; gdyby nie, to kolejny termin zastępuje odłożenie
 * (przypomnienie nie wypada dwa razy). Seria, która się skończyła, zostawia odłożenie jako ostatni termin.
 */
export function snoozeTarget(
  note: { reminder: number | null; reminderRepeat?: ReminderRepeat; reminderRule?: RepeatRule; reminderDay?: number; reminderRepeatUntil?: number; reminderBase?: number; reminderTime?: number },
  at: number,
  now: number,
): { reminder: number; reminderBase: number | undefined } {
  const rule = ruleOf(note);
  if (rule.kind === "none") return { reminder: at, reminderBase: undefined };
  // Zaległe wystąpienia (aplikacja była zamknięta): odkładamy ostatnie, które już minęło, nie stary `reminder`.
  let base = note.reminderBase ?? note.reminder ?? at;
  let seriesNext = nextInSeries(base, rule, seriesDay(note), note.reminderRepeatUntil, seriesMinutes(note));
  for (let i = 0; seriesNext !== null && seriesNext <= now && i < MAX_SERIES_STEPS; i++) {
    base = seriesNext;
    seriesNext = nextInSeries(base, rule, seriesDay(note), note.reminderRepeatUntil, seriesMinutes(note));
  }
  if (seriesNext === null || at < seriesNext) return { reminder: at, reminderBase: base };
  return { reminder: seriesNext, reminderBase: undefined };
}

/**
 * „Gotowe” na przypomnieniu: nowy termin to następne wystąpienie serii, które jeszcze nie minęło
 * (zaległe pomijamy, jak przy odpaleniu). `null` = seria jednorazowa albo już się skończyła.
 */
export function doneTarget(
  note: { reminder: number | null; reminderRepeat?: ReminderRepeat; reminderRule?: RepeatRule; reminderDay?: number; reminderRepeatUntil?: number; reminderBase?: number; reminderTime?: number },
  now: number,
): number | null {
  const rule = ruleOf(note);
  if (note.reminder === null || rule.kind === "none") return null;
  let next = nextOccurrence(note, note.reminder);
  for (let i = 0; next !== null && next <= now && i < MAX_SERIES_STEPS; i++) {
    next = nextInSeries(next, rule, seriesDay(note), note.reminderRepeatUntil, seriesMinutes(note));
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

/** Wejście powtarzania z pickera i kalendarza: sam rodzaj (stare kształty) albo pełna reguła (3.1). */
export type RepeatInput = RepeatKind | RepeatRule;

/**
 * Pola zapisu dla wybranego powtarzania: `reminderRule` i zapasowy `reminderRepeat`, który czytają starsze wersje.
 * Dla starych rodzajów reguła jest czyszczona, żeby nie zostały dwie sprzeczne wartości.
 */
export function repeatUpdate(input: RepeatInput): { reminderRepeat: ReminderRepeat; reminderRule: RepeatRule | undefined } {
  const rule = toRule(input);
  if (!isNewKind(rule.kind)) return { reminderRepeat: rule.kind as ReminderRepeat, reminderRule: undefined };
  return { reminderRepeat: fallbackRepeat(rule), reminderRule: rule };
}

/** Rodzaje z nowszych wersji (3.1), a nie te, które zna każda wersja. */
export function isNewKind(kind: RepeatKind): boolean {
  return kind === "workdays" || kind === "biweekly" || kind === "yearly" || kind === "weekdays" || kind === "every";
}

/** Kolejność dni tygodnia pn–nd (w `Date.getDay()` niedziela to 0). */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_SHORT: Record<number, string> = { 0: "Nd", 1: "Pn", 2: "Wt", 3: "Śr", 4: "Cz", 5: "Pt", 6: "So" };

/** Zmiana rodzaju w liście: wybrane dni zostają, a pusty wybór dostaje dzień terminu; „co N dni” domyślnie co 2. */
export function changeRepeatKind(kind: RepeatKind, prev: RepeatRule, date?: Date): RepeatRule {
  if (kind === "weekdays") {
    const days = weekdaysOf(prev);
    return { kind, days: days.length > 0 ? days : [date ? date.getDay() : 1] };
  }
  if (kind === "every") return { kind, every: prev.every ?? 2 };
  return { kind };
}

/** Przełącza dzień; ostatniego wybranego nie da się odznaczyć, bo seria bez dni nie ma terminów. */
export function toggleWeekday(days: number[], day: number): number[] {
  if (days.includes(day)) return days.length > 1 ? days.filter((d) => d !== day) : days;
  return [...days, day].sort((a, b) => a - b);
}

/** Liczba dni z pola tekstowego, w granicach 1–366. */
export function clampEvery(value: string): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(366, Math.max(1, n)) : 1;
}
