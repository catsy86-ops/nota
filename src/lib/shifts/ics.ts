import { escapeText, foldLine, formatLocal } from "@/lib/icsExport";
import { dayType, isAbsence, type ShiftData } from "./model";
import { shiftSpan } from "./time";

/**
 * Grafik → iCalendar (RFC 5545), żeby zmiany były w kalendarzu telefonu.
 * Stały `UID` per dzień sprawia, że ponowny import po zmianie grafiku
 * aktualizuje wpisy zamiast je dublować. Czas „pływający” jak w eksporcie
 * przypomnień — zmiana ma wypaść o tej samej godzinie ściennej.
 * Nieobecności idą jako wydarzenia całodniowe, bez alarmu.
 */

/** Dni wysłane do kalendarza z tego urządzenia — żeby przy następnym eksporcie odwołać wyczyszczone. */
export const SHIFTS_EXPORTED_KEY = "kaczy:shifts.icsExported";

/** Minuty od 2020 r. jako SEQUENCE — mieści się w liczbie 32-bitowej przez ~4000 lat. */
const SEQUENCE_EPOCH = Date.UTC(2020, 0, 1);

const pad = (n: number) => String(n).padStart(2, "0");

function dateOnly(dayKey: string, plusDays = 0): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const t = new Date(y, m - 1, d + plusDays);
  return `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}`;
}

function utcStamp(ts: number): string {
  return new Date(ts).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Dni od `fromKey` włącznie (klucze „RRRR-MM-DD” sortują się jak daty). */
export function exportableShiftDays(data: ShiftData, fromKey: string): string[] {
  return Object.keys(data.days).filter((k) => k >= fromKey).sort();
}

/**
 * Dni wysłane wcześniejszym eksportem (od `fromKey`), których w grafiku już
 * nie ma — idą jako `STATUS:CANCELLED`, żeby kalendarz je zdjął.
 */
export function cancelledShiftDays(data: ShiftData, exported: string[], fromKey: string): string[] {
  const typeIds = new Set(data.types.map((t) => t.id));
  return exported.filter((k) => k >= fromKey && !typeIds.has(data.days[k]?.type)).sort();
}

/** Zbiór wyeksportowanych dni po eksporcie od `fromKey`: wcześniejsze zostają, reszta = to, co poszło teraz. */
export function exportedAfter(prev: string[], sent: string[], fromKey: string): string[] {
  return [...prev.filter((k) => k < fromKey), ...sent].sort();
}

export function buildShiftsIcs(data: ShiftData, dayKeys: string[], { alarmMinutes = 60, now = Date.now(), cancelled = [] as string[] } = {}): string {
  const typesById = new Map(data.types.map((t) => [t.id, t]));
  const events: string[] = [];
  const sequence = Math.max(0, Math.floor((now - SEQUENCE_EPOCH) / 60_000));

  for (const key of dayKeys) {
    const entry = data.days[key];
    const base = entry && typesById.get(entry.type);
    if (!base) continue;
    const type = dayType(base, entry);
    // SEQUENCE rośnie z każdym eksportem — kalendarze, które znają już ten UID,
    // traktują wpis jako nowszą wersję zamiast go pomijać.
    const lines = ["BEGIN:VEVENT", `UID:shift-${key}@notatnik`, `DTSTAMP:${utcStamp(now)}`, `LAST-MODIFIED:${utcStamp(now)}`, `SEQUENCE:${sequence}`];
    // RFC 5545: właściwości wydarzenia przed blokami VALARM.
    const note = entry.note ? `DESCRIPTION:${escapeText(Array.from(entry.note).slice(0, 1000).join(""))}` : null;

    if (isAbsence(type)) {
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(key)}`, `DTEND;VALUE=DATE:${dateOnly(key, 1)}`, `SUMMARY:${escapeText(type.name)}`, "TRANSP:TRANSPARENT");
      if (note) lines.push(note);
    } else {
      const span = shiftSpan(type);
      if (!span) continue;
      const [y, m, d] = key.split("-").map(Number);
      const start = new Date(y, m - 1, d, 0, span.from).getTime();
      const end = new Date(y, m - 1, d, 0, span.to + (entry.extraMin ?? 0)).getTime();
      lines.push(`DTSTART:${formatLocal(start)}`, `DTEND:${formatLocal(Math.max(end, start + 60_000))}`, `SUMMARY:${escapeText(`Zmiana: ${type.name}`)}`);
      if (note) lines.push(note);
      // Alarm rodzaju zmiany ma pierwszeństwo przed domyślnym eksportu.
      const alarm = type.alarmMin ?? alarmMinutes;
      if (alarm > 0) {
        lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(`Za ${alarm} min zmiana: ${type.name}`)}`, `TRIGGER:-PT${alarm}M`, "END:VALARM");
      }
    }
    lines.push("END:VEVENT");
    events.push(...lines);
  }

  for (const key of cancelled) {
    events.push("BEGIN:VEVENT", `UID:shift-${key}@notatnik`, `DTSTAMP:${utcStamp(now)}`, `LAST-MODIFIED:${utcStamp(now)}`, `SEQUENCE:${sequence}`,
      `DTSTART;VALUE=DATE:${dateOnly(key)}`, `DTEND;VALUE=DATE:${dateOnly(key, 1)}`, "SUMMARY:Wolne", "STATUS:CANCELLED", "TRANSP:TRANSPARENT", "END:VEVENT");
  }

  const all = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Notatnik//Grafik//PL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Grafik zmian",
    ...events,
    "END:VCALENDAR",
  ];
  return all.map(foldLine).join("\r\n") + "\r\n";
}
