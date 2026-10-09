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

  for (const key of dayKeys) {
    const entry = data.days[key];
    const type = entry && typesById.get(entry.type);
    if (!type) continue;
    const lines = ["BEGIN:VEVENT", `UID:shift-${key}@notatnik`, `DTSTAMP:${utcStamp(now)}`];

    if (isAbsence(type)) {
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(key)}`, `DTEND;VALUE=DATE:${dateOnly(key, 1)}`, `SUMMARY:${escapeText(type.name)}`, "TRANSP:TRANSPARENT");
    } else {
      const span = shiftSpan(type);
      if (!span) continue;
      const [y, m, d] = key.split("-").map(Number);
      const start = new Date(y, m - 1, d, 0, span.from).getTime();
      const end = new Date(y, m - 1, d, 0, span.to + (entry.extraMin ?? 0)).getTime();
      lines.push(`DTSTART:${formatLocal(start)}`, `DTEND:${formatLocal(Math.max(end, start + 60_000))}`, `SUMMARY:${escapeText(`Zmiana: ${type.name}`)}`);
      if (alarmMinutes > 0) {
        lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(`Za ${alarmMinutes} min zmiana: ${type.name}`)}`, `TRIGGER:-PT${alarmMinutes}M`, "END:VALARM");
      }
    }
    if (entry.note) lines.push(`DESCRIPTION:${escapeText(entry.note.slice(0, 1000))}`);
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
