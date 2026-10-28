/**
 * Import zmian z pliku .ics do Grafiku (G4.5, E3). Każde VEVENT staje się dniem z jednym rodzajem
 * zmiany (wybranym przez użytkownika), a godziny bierze rodzaj. Dzień z już wpisaną zmianą zostaje
 * nietknięty. Zdarzenia cykliczne (RRULE) rozwijamy do wystąpień: DAILY/WEEKLY/MONTHLY z INTERVAL,
 * COUNT i UNTIL. Bez COUNT i UNTIL rozwijamy najwyżej rok od dziś, co najwyżej 400 wystąpień.
 */
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { parseIcs, type IcsEvent } from "@/lib/icsImport";
import { addDaysToKey, parseDayKey } from "@/lib/week";
import type { DayEntry, ShiftData } from "./model";

/** Bez UNTIL i COUNT zdarzenie rozwijamy tylko tyle dni od dziś — cykliczny import nie zalewa grafiku bez końca. */
export const RECUR_HORIZON_DAYS = 366;
/** Twardy limit wystąpień jednego zdarzenia. */
export const MAX_OCCURRENCES = 400;

/** Dzień, który zostanie zapisany (`status: "import"`) albo został pominięty, bo już coś jest (`"filled"`). */
export interface ShiftImportDay {
  key: string;
  typeId: string;
  typeName: string;
  status: "import" | "filled";
}

export interface ShiftImportPlan {
  /** Dni do zapisania (`YYYY-MM-DD` → wpis). */
  changes: Record<string, DayEntry>;
  /** Ile dni dostanie zmianę. */
  imported: number;
  /** Dni, które już miały wpis albo powtarzały się w pliku. */
  skippedFilled: number;
  /** Zdarzenia cykliczne (ICS), które rozwinięto do wystąpień. */
  repeating: number;
  /** Wpisy bez poprawnej daty albo z nieznanym rodzajem zmiany. */
  unreadable: number;
  /** Podgląd dzień po dniu, posortowany po dacie (dni do zapisania i pominięte). */
  preview: ShiftImportDay[];
}

type Candidate = { key: string; entry: DayEntry };
/** Dni i (opcjonalnie) rodzaje — bez rodzajów podgląd pokaże id zamiast nazwy. */
type PlanData = Pick<ShiftData, "days"> & { types?: ShiftData["types"] };

const pad = (n: number) => String(n).padStart(2, "0");
/** Dzień lokalny z milisekund; całodniowe zdarzenia są już ustawione na 9:00 lokalnie (icsImport). */
export const localDayKey = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

interface Rule {
  freq?: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  count?: number;
  /** Ostatni dzień (`YYYY-MM-DD`) z UNTIL; w UTC bierzemy datę, różnica godziny nie gra roli. */
  untilKey?: string;
}

function parseRule(rrule: string | undefined): Rule {
  const part = (name: string) => rrule?.match(new RegExp(`(?:^|;)${name}=([^;]+)`, "i"))?.[1];
  const freq = part("FREQ")?.toUpperCase();
  const until = part("UNTIL");
  const count = Number(part("COUNT"));
  return {
    freq: freq === "DAILY" || freq === "WEEKLY" || freq === "MONTHLY" ? freq : undefined,
    interval: Math.max(1, Number(part("INTERVAL")) || 1),
    count: Number.isInteger(count) && count > 0 ? count : undefined,
    untilKey: until && /^\d{8}/.test(until) ? `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}` : undefined,
  };
}

/**
 * Dni wszystkich wystąpień zdarzenia (od pierwszego, także przeszłego). Miesięczne wystąpienia,
 * które wypadają poza miesiąc (np. 31 lutego), są pomijane, jak w RFC 5545.
 */
export function occurrenceKeys(event: Pick<IcsEvent, "reminder" | "rrule">, todayKey: string): string[] {
  const rule = parseRule(event.rrule);
  const start = new Date(event.reminder);
  const first = localDayKey(event.reminder);
  if (!rule.freq) return [first];
  const horizon = rule.untilKey ?? addDaysToKey(todayKey, RECUR_HORIZON_DAYS);
  const keys: string[] = [];
  // Pomijanie niepoprawnych miesięcy zabiera iteracje, stąd większy zapas niż limit.
  for (let i = 0; i < MAX_OCCURRENCES * 4 && keys.length < MAX_OCCURRENCES; i++) {
    const at = rule.freq === "MONTHLY"
      ? new Date(start.getFullYear(), start.getMonth() + i * rule.interval, start.getDate(), start.getHours(), start.getMinutes())
      : new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * rule.interval * (rule.freq === "WEEKLY" ? 7 : 1), start.getHours(), start.getMinutes());
    if (rule.freq === "MONTHLY" && at.getDate() !== start.getDate()) continue;
    const key = localDayKey(at.getTime());
    if (key > horizon) break;
    keys.push(key);
    if (rule.count !== undefined && keys.length >= rule.count) break;
  }
  return keys;
}

/**
 * Z kandydatów (dzień → wpis) robi plan: dzień zajęty albo powtórzony w pliku trafia do podglądu
 * jako pominięty. Pierwszy wpis dla dnia wygrywa.
 */
export function finishPlan(candidates: Candidate[], data: PlanData, unreadable: number, repeating: number): ShiftImportPlan {
  const names = new Map((data.types ?? []).map((t) => [t.id, t.name]));
  const changes: Record<string, DayEntry> = {};
  const preview: ShiftImportDay[] = [];
  let skippedFilled = 0;
  for (const { key, entry } of candidates) {
    const status = data.days[key] || changes[key] ? "filled" : "import";
    if (status === "import") changes[key] = entry;
    else skippedFilled += 1;
    preview.push({ key, typeId: entry.type, typeName: names.get(entry.type) ?? entry.type, status });
  }
  preview.sort((a, b) => a.key.localeCompare(b.key));
  return { changes, imported: Object.keys(changes).length, skippedFilled, repeating, unreadable, preview };
}

export function planShiftsFromIcs(text: string, data: PlanData, typeId: string, now: number = Date.now()): ShiftImportPlan {
  const { events, skipped } = parseIcs(text, now, { keepPast: true });
  const todayKey = localDayKey(now);
  const candidates: Candidate[] = [];
  let repeating = 0;
  for (const e of events) {
    if (e.repeat !== "none") repeating += 1;
    for (const key of occurrenceKeys(e, todayKey)) candidates.push({ key, entry: { type: typeId } });
  }
  return finishPlan(candidates, data, skipped, repeating);
}

/** Podpis dnia w podglądzie importu, np. „wt 6 paź”. */
export const previewDayLabel = (key: string): string => format(parseDayKey(key), "EEE d LLL", { locale: pl });
