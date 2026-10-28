/**
 * Import karty czasu z CSV (E3, G4.5) — odwrotność `buildTimesheetCsv`. Rodzaj zmiany bierzemy
 * z kolumny „Zmiana” (po nazwie), a odchylenie, notatkę i datę z tych samych kolumn co eksport.
 * Godziny z kolumn „Od/Do” nie są czytane: wynikają z rodzaju i odchylenia.
 */
import { finishPlan, type ShiftImportPlan } from "./icsShifts";
import type { DayEntry, ShiftData } from "./model";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Rozbija tekst na pola z separatorem `;`: BOM, pola w cudzysłowie (`""` to cudzysłów), CRLF albo LF. */
export function parseSemicolonCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (src[i + 1] === '"') { field += '"'; i++; }
      else quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ";") { row.push(field); field = ""; }
    else if (c === "\r" || c === "\n") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** Eksport dopisuje apostrof przed tekstem zaczynającym się od `=`, `+`, `-`, `@`, tabulatora albo CR. */
const unguard = (s: string): string => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s);

/**
 * Plan importu z karty czasu. `null`, gdy w pliku nie ma nagłówka „Data” i „Zmiana” — to nie jest
 * plik z Grafiku. Wiersze bez daty (suma miesiąca) są pomijane. Nieznana nazwa zmiany = nieczytelny wiersz.
 */
export function planShiftsFromCsv(text: string, data: Pick<ShiftData, "days" | "types">): ShiftImportPlan | null {
  const rows = parseSemicolonCsv(text);
  const head = rows.findIndex((r) => r.includes("Data") && r.includes("Zmiana"));
  if (head < 0) return null;
  const col = (name: string) => rows[head].indexOf(name);
  const iDate = col("Data");
  const iType = col("Zmiana");
  const iExtra = col("Odchylenie (min)");
  const iNote = col("Notatka");
  const typeByName = new Map(data.types.map((t) => [t.name, t.id]));
  const candidates: { key: string; entry: DayEntry }[] = [];
  let unreadable = 0;
  for (const r of rows.slice(head + 1)) {
    const date = (r[iDate] ?? "").trim();
    if (!DATE.test(date)) continue;
    const typeId = typeByName.get((r[iType] ?? "").trim());
    if (!typeId) { unreadable += 1; continue; }
    const entry: DayEntry = { type: typeId };
    const extra = Number.parseInt(r[iExtra] ?? "", 10);
    if (Number.isFinite(extra) && extra !== 0) entry.extraMin = extra;
    const note = unguard((r[iNote] ?? "").trim());
    if (note) entry.note = note;
    candidates.push({ key: date, entry });
  }
  return finishPlan(candidates, data, unreadable, 0);
}
