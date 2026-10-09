import { escapeText, foldLine, formatLocal } from "@/lib/icsExport";
import { isAbsence, type ShiftData } from "./model";
import { shiftSpan } from "./time";

/**
 * Grafik → iCalendar (RFC 5545), żeby zmiany były w kalendarzu telefonu.
 * Stały `UID` per dzień sprawia, że ponowny import po zmianie grafiku
 * aktualizuje wpisy zamiast je dublować. Czas „pływający” jak w eksporcie
 * przypomnień — zmiana ma wypaść o tej samej godzinie ściennej.
 * Nieobecności idą jako wydarzenia całodniowe, bez alarmu.
 */

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

export function buildShiftsIcs(data: ShiftData, dayKeys: string[], { alarmMinutes = 60, now = Date.now() } = {}): string {
  const typesById = new Map(data.types.map((t) => [t.id, t]));
  const events: string[] = [];
  const sequence = Math.max(0, Math.floor((now - SEQUENCE_EPOCH) / 60_000));

  for (const key of dayKeys) {
    const entry = data.days[key];
    const type = entry && typesById.get(entry.type);
    if (!type) continue;
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
      if (alarmMinutes > 0) {
        lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(`Za ${alarmMinutes} min zmiana: ${type.name}`)}`, `TRIGGER:-PT${alarmMinutes}M`, "END:VALARM");
      }
    }
    lines.push("END:VEVENT");
    events.push(...lines);
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
