import type { Note } from "@/hooks/useNotes";
import { ruleOf, seriesDay, weekdaysOf, type RepeatRule } from "@/lib/reminderRepeat";

/**
 * Eksport terminów do iCalendar (RFC 5545).
 *
 * Powiadomienia aplikacji działają tylko przy otwartej karcie — plik `.ics`
 * oddaje dostarczanie przypomnień kalendarzowi systemowemu (Google, Apple,
 * Outlook), bez serwera. To jednorazowa kopia, nie synchronizacja: stały `UID`
 * (id notatki) sprawia, że ponowny import aktualizuje wpis zamiast go dublować.
 *
 * Czas jest „pływający” (lokalny, bez `Z` i bez `TZID`): termin ma wypaść
 * o tej samej godzinie ściennej, tak jak w aplikacji — także po zmianie
 * czasu na letni w serii.
 */

const RRULE: Record<string, string> = {
  daily: "FREQ=DAILY",
  weekly: "FREQ=WEEKLY",
  monthly: "FREQ=MONTHLY",
  yearly: "FREQ=YEARLY",
  workdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  biweekly: "FREQ=WEEKLY;INTERVAL=2",
};

/** Przypomnienie to punkt w czasie; kalendarze źle znoszą zdarzenia zerowej długości. */
const EVENT_MINUTES = 15;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatLocal(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function formatUtc(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

/** Linie dłuższe niż 75 bajtów UTF-8 zawijamy (CRLF + spacja), nie tnąc znaków. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // kontynuacja zaczyna się spacją
    if (bytes + b > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function titleOf(note: Note): string {
  if (note.locked) return "Przypomnienie z notatki prywatnej";
  return note.title.trim() || note.content.trim().split("\n")[0].slice(0, 60) || "Przypomnienie";
}

/**
 * Seria miesięczna od 29.–31.: sam `FREQ=MONTHLY` pominąłby miesiące bez tego dnia,
 * a aplikacja bierze wtedy ostatni dzień miesiąca. „Ostatni z dni 28…N” w każdym
 * miesiącu (`BYSETPOS=-1`) daje dokładnie to samo.
 */
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/**
 * Reguła RFC 5545 dla rodzaju z notatki. „Wybrane dni” to `BYDAY`, „co N dni” to `INTERVAL`.
 * „Co rok” z 29 lutego zostaje zwykłym `FREQ=YEARLY`, bo RFC nie ma odpowiednika dla „28 albo 29”:
 * w roku bez tego dnia wystąpienie wypada 1 marca (aplikacja liczy 28 lutego).
 */
function rruleFor(rule: RepeatRule, day: number | undefined): string {
  if (rule.kind === "weekdays") return `FREQ=WEEKLY;BYDAY=${weekdaysOf(rule).map((d) => BYDAY[d]).join(",")}`;
  if (rule.kind === "every") return `FREQ=DAILY;INTERVAL=${Math.max(1, Math.round(rule.every ?? 1))}`;
  if (rule.kind !== "monthly" || !day || day <= 28) return RRULE[rule.kind];
  const days = Array.from({ length: day - 27 }, (_, i) => 28 + i).join(",");
  return `${RRULE.monthly};BYMONTHDAY=${days};BYSETPOS=-1`;
}

function eventLines(note: Note, now: number): string[] {
  const start = note.reminder!;
  const repeat = ruleOf(note);
  const lines = [
    "BEGIN:VEVENT",
    `UID:${note.id}@notatnik`,
    `DTSTAMP:${formatUtc(now)}`,
    `DTSTART:${formatLocal(start)}`,
    `DTEND:${formatLocal(start + EVENT_MINUTES * 60_000)}`,
    `SUMMARY:${escapeText(titleOf(note))}`,
  ];
  if (repeat.kind !== "none") {
    // UNTIL musi mieć ten sam typ co DTSTART (RFC 5545). DTSTART jest lokalny (bez „Z”),
    // więc UNTIL też lokalny — UTC przy lokalnym DTSTART ścisłe importery odrzucają.
    const until = note.reminderRepeatUntil !== undefined ? `;UNTIL=${formatLocal(note.reminderRepeatUntil)}` : "";
    lines.push(`RRULE:${rruleFor(repeat, seriesDay(note))}${until}`);
  }
  const body = note.content.trim();
  if (body) lines.push(`DESCRIPTION:${escapeText(body.slice(0, 1000))}`);
  lines.push(
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(titleOf(note))}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
  );
  return lines;
}

/** Notatki warte eksportu: z terminem w przyszłości albo z serią. Bez kosza. */
export function exportableReminders(notes: Note[], now = Date.now()): Note[] {
  return notes.filter((n) =>
    !n.trashed && n.reminder !== null && (n.reminder >= now || ruleOf(n).kind !== "none"),
  );
}

export function buildIcs(notes: Note[], now = Date.now()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Notatnik//Przypomnienia//PL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...notes.filter((n) => n.reminder !== null).flatMap((n) => eventLines(n, now)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
