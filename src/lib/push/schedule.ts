import { addDays } from "date-fns";
import { nextInSeries, seriesDay, type ReminderRepeat } from "@/lib/reminderRepeat";
import { eveningNudgeFor } from "@/lib/shifts/eveningNudge";
import type { ShiftData, ShiftType } from "@/lib/shifts/model";
import { REMINDER_ORDER_DAYS, REMINDER_PROBLEM_DAYS } from "@/lib/study/reminders";
import { reportDueMinute } from "@/lib/study/reportNudge";
import { entriesPl } from "@/lib/study/journalView";
import { dayKeyOf, shiftKey } from "@/lib/study/report";
import { JOURNAL_REPORT_PARAM, reportParam } from "@/lib/study/reportLink";
import { entrySiteId } from "@/lib/study/sites";
import type { Shortage } from "@/lib/study/shortages";
import type { ServiceCall } from "@/lib/study/service";
import type { JournalEntry } from "@/lib/study/yStudy";
import { notePath } from "@/lib/viewRoute";
import { pushKey } from "./shown";

/**
 * Terminy dla serwera push (`push-server/`): to samo, co strona przypomina timerami przy otwartej
 * aplikacji, policzone z góry na `PUSH_HORIZON_DAYS` dni. Lista jest wysyłana na nowo przy każdej
 * zmianie danych, więc warunki „na teraz” (raport dnia, problem > 3 dni) liczymy z bieżącego stanu.
 * Czysta funkcja — wysyłka w `client.ts`.
 */
export interface PushItem {
  /** Klucz `pushKey` — ten sam liczy strona, żeby nie pokazać terminu drugi raz. */
  key: string;
  at: number;
  title: string;
  body: string;
  url: string;
}

export const PUSH_HORIZON_DAYS = 14;
/** Limit serwera (`push-server/core.js`, `LIMITS.items`). */
export const PUSH_MAX_ITEMS = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Przypomnienia „od N dni” nie budzą w nocy: między 21:00 a 7:00 przesuwamy na 7:00. */
const QUIET_FROM = 21;
const QUIET_TO = 7;

export interface PushNote {
  id: string;
  title: string;
  content: string;
  reminder: number | null;
  reminderDay?: number;
  reminderRepeat?: ReminderRepeat;
  reminderRepeatUntil?: number;
  locked?: boolean;
}

export interface PushSite {
  id: string;
  name: string;
  archived?: number;
  shortages?: Shortage[];
  service?: ServiceCall[];
}

export interface PushInput {
  now: number;
  notes: readonly PushNote[];
  journal?: readonly JournalEntry[];
  sites?: Readonly<Record<string, PushSite>>;
  shifts?: ShiftData | null;
  /** Godzina wieczornego przypomnienia Grafiku („20:00”) albo `null` — wyłączone. */
  eveningTime?: string | null;
  /** Ostatnie już pokazane przypomnienia (localStorage stron) — tych nie planujemy drugi raz. */
  eveningNudged?: string | null;
  reportNudged?: string | null;
  weekReportNudged?: string | null;
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const firstLine = (s: string) => s.split("\n").find((l) => l.trim())?.trim() ?? "";

/** Przesuwa termin z nocy na 7:00 (tego samego albo następnego dnia). */
export function outsideQuietHours(at: number): number {
  const d = new Date(at);
  const h = d.getHours();
  if (h >= QUIET_TO && h < QUIET_FROM) return at;
  const morning = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (h >= QUIET_FROM ? 1 : 0), QUIET_TO);
  return morning.getTime();
}

function noteItems(notes: readonly PushNote[], now: number, end: number): PushItem[] {
  const out: PushItem[] = [];
  for (const n of notes) {
    if (!n.reminder) continue;
    // Notatka prywatna: ani tytułu, ani treści na serwerze.
    const title = n.locked ? "Przypomnienie z notatki prywatnej" : clip(n.title.trim() || firstLine(n.content) || "Przypomnienie", 120);
    const body = n.locked ? "Otwórz NOTKI i odblokuj skarbiec, aby zobaczyć notatkę." : "Przypomnienie z NOTKI";
    const repeat = n.reminderRepeat ?? "none";
    let at: number | null = n.reminder;
    // Seria: kolejne terminy też — strona przesuwa `reminder` dopiero, gdy jest otwarta.
    for (let i = 0; at !== null && at <= end && i < 60; i++) {
      if (at > now) out.push({ key: pushKey.note(n.id, at), at, title, body, url: notePath(n.id) });
      if (repeat === "none") break;
      at = nextInSeries(at, repeat, seriesDay(n), n.reminderRepeatUntil);
    }
  }
  return out;
}

const atMinute = (dayKey: string, minute: number) => {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d, Math.floor(minute / 60), minute % 60).getTime();
};

function eveningItems(input: PushInput, now: number): PushItem[] {
  const { shifts, eveningTime } = input;
  if (!shifts || !eveningTime) return [];
  const [h, m] = eveningTime.split(":").map(Number);
  const typesById = new Map<string, ShiftType>(shifts.types.map((t) => [t.id, t]));
  const out: PushItem[] = [];
  for (let i = 0; i < PUSH_HORIZON_DAYS; i++) {
    const day = addDays(new Date(now), i);
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime();
    if (at <= now) continue;
    const nudge = eveningNudgeFor(new Date(at), eveningTime, input.eveningNudged ?? null, shifts.days, typesById);
    if (nudge) out.push({ key: pushKey.evening(nudge.forKey), at, title: nudge.title, body: nudge.description ?? "Grafik na jutro.", url: "/grafik" });
  }
  return out;
}

const sitesPl = (n: number) => (n > 1 ? ` na ${n} budowach` : "");

/** Raport dnia (dziś po zmianie) i tygodnia (w piątek po zmianie) — z wpisów, które już są. */
function reportItems(input: PushInput, now: number): PushItem[] {
  const journal = input.journal ?? [];
  const out: PushItem[] = [];
  const today = dayKeyOf(now);
  const siteCount = (list: readonly JournalEntry[]) => new Set(list.map((e) => entrySiteId(e))).size;

  const nowDate = new Date(now);
  const back = (nowDate.getDay() + 6) % 7;
  const monday = dayKeyOf(new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() - back).getTime());
  const friday = shiftKey(monday, 4);
  let weekAt: number | null = null;
  if (input.weekReportNudged !== monday && friday >= today) {
    const at = atMinute(friday, reportDueMinute(input.shifts, friday));
    const from = shiftKey(friday, -6);
    const week = journal.filter((e) => { const k = dayKeyOf(e.at); return k >= from && k <= friday; });
    if (at > now && week.length > 0) {
      weekAt = at;
      out.push({
        key: pushKey.reportWeek(monday), at, title: "Raport tygodnia gotowy",
        body: `${entriesPl(week.length)} z 7 dni${sitesPl(siteCount(week))} — wyślij szefowi jednym stuknięciem.`,
        url: `/praca?${JOURNAL_REPORT_PARAM}=${reportParam({ range: "week", allSites: siteCount(week) > 1 })}`,
      });
    }
  }

  if (input.reportNudged !== today) {
    const at = atMinute(today, reportDueMinute(input.shifts, today));
    const day = journal.filter((e) => dayKeyOf(e.at) === today);
    // Piątek: raport tygodnia obejmuje dzisiejsze wpisy — dziennego wtedy nie wysyłamy.
    if (at > now && day.length > 0 && weekAt !== at) {
      out.push({
        key: pushKey.reportDay(today), at, title: "Raport dnia gotowy",
        body: `${entriesPl(day.length)} z dziś${sitesPl(siteCount(day))} — wyślij szefowi jednym stuknięciem.`,
        url: `/praca?${JOURNAL_REPORT_PARAM}=${reportParam({ range: "day", allSites: siteCount(day) > 1 })}`,
      });
    }
  }
  return out;
}

/** Problemy otwarte i materiał zamówiony bez dostawy — w chwili, gdy minie próg z `reminders.ts`. */
function studyItems(input: PushInput, now: number, end: number): PushItem[] {
  const out: PushItem[] = [];
  for (const e of input.journal ?? []) {
    if (e.kind !== "problem" || e.resolved !== undefined) continue;
    const at = outsideQuietHours(e.at + REMINDER_PROBLEM_DAYS * DAY_MS);
    if (at <= now || at > end) continue;
    const where = e.site.trim();
    out.push({
      key: pushKey.problem(e.id), at, title: `Problem otwarty od ${REMINDER_PROBLEM_DAYS} dni`,
      body: clip(`${where ? `${where}: ` : ""}${firstLine(e.text) || "bez opisu"}`, 200), url: "/praca",
    });
  }
  // Serwis: rano w dniu wizyty — także budowy w archiwum (serwis jest po odbiorze).
  for (const site of Object.values(input.sites ?? {})) {
    for (const c of site.service ?? []) {
      if (c.done !== undefined || !c.due) continue;
      const [y, m, d] = c.due.split("-").map(Number);
      const at = new Date(y, m - 1, d, QUIET_TO).getTime();
      if (at <= now || at > end) continue;
      out.push({ key: pushKey.service(c.id, c.due), at, title: `Serwis dziś: ${site.name}`, body: clip(c.text, 200), url: "/praca" });
    }
  }
  for (const site of Object.values(input.sites ?? {})) {
    if (site.archived !== undefined) continue;
    for (const s of site.shortages ?? []) {
      if (s.status !== "ordered") continue;
      const since = s.changed ?? s.at;
      const at = outsideQuietHours(since + REMINDER_ORDER_DAYS * DAY_MS);
      if (at <= now || at > end) continue;
      out.push({
        key: pushKey.order(s.id, since), at, title: "Materiał zamówiony, a nie dojechał",
        body: clip(`${site.name}: ${s.text}${s.qty ? ` (${s.qty})` : ""} — zamówione ${REMINDER_ORDER_DAYS} dni temu.`, 200), url: "/praca",
      });
    }
  }
  return out;
}

export function buildPushSchedule(input: PushInput): PushItem[] {
  const { now } = input;
  const end = now + PUSH_HORIZON_DAYS * DAY_MS;
  return [
    ...noteItems(input.notes, now, end),
    ...eveningItems(input, now),
    ...reportItems(input, now),
    ...studyItems(input, now, end),
  ]
    .sort((a, b) => a.at - b.at)
    .slice(0, PUSH_MAX_ITEMS);
}
