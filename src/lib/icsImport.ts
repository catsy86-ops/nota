import type { Note } from "@/hooks/useNotes";
import { yjsStore } from "@/lib/yjsStore";
import { DEFAULT_REMINDER_TIME } from "@/lib/reminderTime";

/**
 * Import przypomnień z pliku iCalendar (.ics) — odwrotność eksportu (`icsExport.ts`).
 * Każde VEVENT z czasem startu staje się notatką z terminem. Obsługiwane: DTSTART lokalny (bez `Z`),
 * UTC (`Z`) i całodniowy (`VALUE=DATE`, wtedy 9:00), RRULE `FREQ=DAILY|WEEKLY|MONTHLY` jako powtarzanie.
 * Terminy w przeszłości i duplikaty (ten sam tytuł i termin) są pomijane.
 */

export type IcsRepeat = "none" | "daily" | "weekly" | "monthly";

export interface IcsEvent {
  title: string;
  content: string;
  reminder: number;
  repeat: IcsRepeat;
  /** Surowa reguła RRULE (E3 rozwija wystąpienia w imporcie Grafiku); brak = zdarzenie jednorazowe. */
  rrule?: string;
  allDay: boolean;
}

export interface IcsParseResult {
  events: IcsEvent[];
  /** Zdarzenia bez czasu startu albo z niepoprawną datą. */
  skipped: number;
}

/** Odwija linie (RFC 5545: kontynuacja zaczyna się spacją lub tabulatorem). */
function unfold(text: string): string[] {
  return text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

/** Wartość tekstowa: `\n`, `\,`, `\;`, `\` z powrotem na znaki. */
function unescapeText(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

/** Dane DTSTART: liczba ms (lokalnie albo UTC) i czy to dzień bez godziny. */
function parseStart(line: string): { ms: number; allDay: boolean } | null {
  const idx = line.indexOf(":");
  if (idx < 0) return null;
  const params = line.slice(0, idx).toUpperCase();
  const value = line.slice(idx + 1).trim();
  const date = /^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value);
  if (!date) return null;
  const [, y, mo, d, , hh, mm, ss, z] = date;
  const year = Number(y), month = Number(mo) - 1, day = Number(d);
  if (!hh) {
    // Całodniowy: 9:00 lokalnie, tak jak termin „cały dzień” w aplikacji.
    const [h, m] = DEFAULT_REMINDER_TIME.split(":").map(Number);
    return { ms: new Date(year, month, day, h, m).getTime(), allDay: true };
  }
  const H = Number(hh), M = Number(mm), S = Number(ss ?? 0);
  if (H > 23 || M > 59 || S > 59) return null;
  void params;
  if (z) return { ms: Date.UTC(year, month, day, H, M, S), allDay: false };
  return { ms: new Date(year, month, day, H, M, S).getTime(), allDay: false };
}

function parseRepeat(rrule: string | undefined): IcsRepeat {
  const freq = rrule?.match(/FREQ=(DAILY|WEEKLY|MONTHLY)/i)?.[1]?.toUpperCase();
  if (freq === "DAILY") return "daily";
  if (freq === "WEEKLY") return "weekly";
  if (freq === "MONTHLY") return "monthly";
  return "none";
}

/** Czyta VEVENT-y z tekstu pliku .ics. `now` odcina terminy już minione. */
/** `keepPast` (E3): zdarzenia z przeszłości zostają — import grafiku dotyczy dni, które już minęły. */
export function parseIcs(text: string, now: number = Date.now(), opts: { keepPast?: boolean } = {}): IcsParseResult {
  const events: IcsEvent[] = [];
  let skipped = 0;
  let current: Record<string, string> | null = null;
  let startLine: string | null = null;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") { current = {}; startLine = null; continue; }
    if (line === "END:VEVENT") {
      if (current) {
        const start = startLine ? parseStart(startLine) : null;
        if (!start) skipped++;
        else if (opts.keepPast || start.ms >= now) {
          const title = unescapeText(current.SUMMARY ?? "").trim() || "Przypomnienie z kalendarza";
          events.push({
            title,
            content: unescapeText(current.DESCRIPTION ?? ""),
            reminder: start.ms,
            repeat: parseRepeat(current.RRULE),
            rrule: current.RRULE,
            allDay: start.allDay,
          });
        }
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const name = line.split(/[;:]/)[0].toUpperCase();
    if (name === "DTSTART") { startLine = line; continue; }
    const idx = line.indexOf(":");
    if (idx > 0 && ["SUMMARY", "DESCRIPTION", "RRULE"].includes(name)) current[name] = line.slice(idx + 1);
  }
  return { events, skipped };
}

/** Zapisuje zdarzenia jako notatki (bez duplikatów: ten sam tytuł i termin). Zwraca liczbę dodanych. */
export function importIcsEvents(events: IcsEvent[], existing: readonly Note[]): number {
  const seen = new Set(existing.map((n) => `${n.title}|${n.reminder ?? ""}`));
  let created = 0;
  for (const ev of events) {
    const key = `${ev.title}|${ev.reminder}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const now = Date.now();
    const note: Note = {
      id: crypto.randomUUID(),
      title: ev.title,
      content: ev.content,
      color: "default",
      pinned: false,
      archived: false,
      trashed: false,
      trashedAt: null,
      labels: [],
      reminder: ev.reminder,
      reminderRepeat: ev.repeat,
      ...(ev.allDay ? { reminderAllDay: true } : {}),
      priority: "none",
      images: [],
      checklist: [],
      folderId: null,
      order: 0,
      createdAt: now,
      updatedAt: now,
    } as Note;
    yjsStore.upsertNote(note);
    created++;
  }
  return created;
}

/** Wczytuje wybrane pliki .ics i zapisuje z nich przypomnienia. Zwraca podsumowanie do komunikatu. */
export async function importIcsFiles(files: File[], existing: readonly Note[]): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  const known = [...existing];
  for (const file of files) {
    const parsed = parseIcs(await file.text());
    skipped += parsed.skipped;
    const n = importIcsEvents(parsed.events, known);
    created += n;
    // Dopisz do „znanych”, żeby duplikaty między plikami też wypadały.
    known.push(...parsed.events.slice(0, n).map((ev) => ({ title: ev.title, reminder: ev.reminder }) as unknown as Note));
  }
  return { created, skipped };
}
