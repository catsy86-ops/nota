import { addDays } from "date-fns";
import { nextOccurrence, ruleOf, type ReminderRepeat } from "@/lib/reminderRepeat";
import { eveningNudgeFor } from "@/lib/shifts/eveningNudge";
import { dayType, SHIFT_ALARM_DEFAULT_MIN, type ShiftData, type ShiftType } from "@/lib/shifts/model";
import { shiftSpan } from "@/lib/shifts/time";
import { REMINDER_ORDER_DAYS, REMINDER_PROBLEM_DAYS } from "@/lib/study/reminders";
import { reportDueMinute } from "@/lib/study/reportNudge";
import { entriesPl } from "@/lib/study/journalView";
import { dayKeyOf, shiftKey } from "@/lib/study/report";
import { JOURNAL_REPORT_PARAM, reportParam } from "@/lib/study/reportLink";
import { entrySiteId } from "@/lib/study/sites";
import { siteCardUrl } from "@/lib/study/siteLink";
import { orderLateFrom, type Shortage } from "@/lib/study/shortages";
import type { ServiceCall } from "@/lib/study/service";
import type { SiteHours } from "@/lib/study/siteHours";
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
  /** Przypomnienie jednorazowe: powiadomienie ma „Odłóż 10 min” (seria — tylko „Gotowe”). */
  snooze?: boolean;
}

export const PUSH_HORIZON_DAYS = 14;

/**
 * Kategorie przypomnień, które użytkownik może wyłączyć w Ustawieniach. Klucz terminu zaczyna się
 * od prefiksu z `pushKey` (`lib/push/shown.ts`), więc kategoria wynika z samego klucza.
 */
export const PUSH_CATEGORIES = [
  { id: "notatki", label: "Przypomnienia notatek", prefixes: ["n:"] },
  { id: "grafik", label: "Grafik na jutro i alarm przed zmianą", prefixes: ["e:", "a:"] },
  { id: "raporty", label: "Raport dnia i tygodnia", prefixes: ["rd:", "rw:"] },
  { id: "problemy", label: "Problem w dzienniku budowy", prefixes: ["p:"] },
  { id: "serwis", label: "Serwis dziś i zaległy", prefixes: ["v:"] },
  { id: "zamowienia", label: "Materiał zamówiony, a nie dojechał", prefixes: ["o:"] },
] as const;
export type PushCategoryId = (typeof PUSH_CATEGORIES)[number]["id"];

/** Czy termin należy do kategorii wyłączonej przez użytkownika. */
export function isPushCategoryOff(key: string, off: readonly string[] | undefined): boolean {
  if (!off?.length) return false;
  const cat = PUSH_CATEGORIES.find((c) => c.prefixes.some((p) => key.startsWith(p)));
  return cat !== undefined && off.includes(cat.id);
}
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
  reminderTime?: number;
  locked?: boolean;
}

export interface PushSite {
  id: string;
  name: string;
  archived?: number;
  shortages?: Shortage[];
  service?: ServiceCall[];
  hours?: SiteHours[];
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
  /** Wyłączone kategorie (`PUSH_CATEGORIES`) — ich terminów nie planujemy wcale, więc nie zajmują limitu. */
  off?: readonly string[];
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
    const body = n.locked ? "Otwórz G i odblokuj skarbiec, aby zobaczyć notatkę." : "Przypomnienie z G";
    const repeat = ruleOf(n).kind;
    let at: number | null = n.reminder;
    // Seria: kolejne terminy też — strona przesuwa `reminder` dopiero, gdy jest otwarta.
    for (let i = 0; at !== null && at <= end && i < 60; i++) {
      if (at > now) out.push({ key: pushKey.note(n.id, at), at, title, body, url: notePath(n.id), snooze: true });
      if (repeat === "none") break;
      at = nextOccurrence(n, at);
    }
  }
  return out;
}

const atMinute = (dayKey: string, minute: number) => {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d, Math.floor(minute / 60), minute % 60).getTime();
};

/**
 * Alarm przed zmianą (G4.1): push `alarmBeforeMin` minut przed początkiem zmiany tego dnia.
 * Domyślnie godzina (`SHIFT_ALARM_DEFAULT_MIN`), 0 wyłącza. Urlop i dzień bez godzin nie mają alarmu.
 */
function shiftAlarmItems(input: PushInput, now: number): PushItem[] {
  const { shifts } = input;
  if (!shifts) return [];
  const min = shifts.alarmBeforeMin ?? SHIFT_ALARM_DEFAULT_MIN;
  if (min <= 0) return [];
  const typesById = new Map<string, ShiftType>(shifts.types.map((t) => [t.id, t]));
  const out: PushItem[] = [];
  for (let i = 0; i < PUSH_HORIZON_DAYS; i++) {
    const day = addDays(new Date(now), i);
    const key = dayKeyOf(day.getTime());
    const entry = shifts.days[key];
    const base = entry && typesById.get(entry.type);
    if (!entry || !base) continue;
    const t = dayType(base, entry);
    if (t.kind !== "work") continue;
    const span = shiftSpan(t);
    if (!span) continue;
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() + span.from * 60_000;
    const at = start - min * 60_000;
    if (at <= now) continue;
    out.push({
      key: pushKey.shiftAlarm(key), at,
      title: `Zmiana za ${min} min: ${t.name}`,
      body: `${t.start}–${t.end}`,
      url: "/grafik",
    });
  }
  return out;
}

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
  // Dziś była zmiana (2.3): wieczorem przypomnij o wpisie w dzienniku i o podziale godzin, jeśli ich brakuje.
  const todayKey = dayKeyOf(now);
  const todayEntry = shifts.days[todayKey];
  const todayBase = todayEntry && typesById.get(todayEntry.type);
  const nowDate = new Date(now);
  const at = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), h, m).getTime();
  if (todayBase && dayType(todayBase, todayEntry).kind === "work" && at > now) {
    const journalToday = (input.journal ?? []).some((e) => dayKeyOf(e.at) === todayKey);
    const hoursToday = Object.values(input.sites ?? {}).some((c) => c.hours?.some((x) => x.id === todayKey));
    if (!journalToday || !hoursToday) {
      out.push({
        key: pushKey.shiftCheck(todayKey), at,
        title: journalToday ? "Dziś zmiana: podziel godziny między budowy" : "Dziś zmiana: brak wpisu w dzienniku",
        body: "Zapisz, co zrobiono, i ile godzin na której budowie — zanim dzień się skończy.",
        url: "/praca",
      });
    }
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
  // Wizyta wciąż otwarta następnego dnia rano dostaje drugie przypomnienie („zaległy”) z osobnym kluczem.
  for (const [siteId, site] of Object.entries(input.sites ?? {})) {
    for (const c of site.service ?? []) {
      if (c.done !== undefined || !c.due) continue;
      const [y, m, d] = c.due.split("-").map(Number);
      const onDay = new Date(y, m - 1, d, QUIET_TO).getTime();
      if (onDay > now && onDay <= end) {
        out.push({ key: pushKey.service(c.id, c.due), at: onDay, title: `Serwis dziś: ${site.name}`, body: clip(c.text, 200), url: siteCardUrl(siteId) });
      }
      const late = new Date(y, m - 1, d + 1, QUIET_TO).getTime();
      if (late > now && late <= end) {
        out.push({ key: pushKey.service(c.id, `${c.due}+1`), at: late, title: `Serwis zaległy: ${site.name}`, body: clip(`${c.text} — termin był ${c.due}`, 200), url: siteCardUrl(siteId) });
      }
    }
  }
  for (const [siteId, site] of Object.entries(input.sites ?? {})) {
    if (site.archived !== undefined) continue;
    for (const s of site.shortages ?? []) {
      // Dostawa w dniu terminu (2.2): rano tego dnia, zanim zacznie się liczyć spóźnienie.
      if (s.status === "ordered" && s.due !== undefined) {
        const dd = new Date(s.due);
        const morning = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate(), QUIET_TO).getTime();
        if (morning > now && morning <= end) {
          out.push({ key: pushKey.delivery(s.id, s.due), at: morning, title: `Dostawa dziś: ${site.name}`, body: clip(`${s.text}${s.qty ? ` (${s.qty})` : ""}`, 200), url: siteCardUrl(siteId) });
        }
      }
      const from = orderLateFrom(s);
      if (from === null) continue;
      const at = outsideQuietHours(from);
      if (at <= now || at > end) continue;
      // Z datą dostawy klucz to ta data (zmiana dostawy = nowe powiadomienie); bez niej — jak dotąd, od zmiany.
      out.push({
        key: pushKey.order(s.id, s.due ?? s.changed ?? s.at), at, title: "Materiał zamówiony, a nie dojechał",
        body: clip(
          `${site.name}: ${s.text}${s.qty ? ` (${s.qty})` : ""} — ${s.due !== undefined ? "dostawa miała być tego dnia" : `zamówione ${REMINDER_ORDER_DAYS} dni temu`}.`,
          200,
        ),
        url: siteCardUrl(siteId),
      });
    }
  }
  return out;
}

/**
 * Harmonogram do serwera z limitem `PUSH_MAX_ITEMS`. Gdy pozycji jest za dużo, pierwszeństwo mają
 * przypomnienia z notatek, potem Praca (serwis, zamówienia, problemy), na końcu nakazy Grafiku i raporty.
 * W ramach grupy — wcześniejsze. `dropped` = ile pozycji nie zmieściło się w limicie (widać w Ustawieniach).
 */
export function buildPushSchedulePlan(input: PushInput): { items: PushItem[]; total: number; dropped: number } {
  const { now } = input;
  const end = now + PUSH_HORIZON_DAYS * DAY_MS;
  const groups = [
    noteItems(input.notes, now, end),
    studyItems(input, now, end),
    [...eveningItems(input, now), ...reportItems(input, now), ...shiftAlarmItems(input, now)],
  ].map((g) => g.filter((i) => !isPushCategoryOff(i.key, input.off)).sort((a, b) => a.at - b.at));
  const total = groups.reduce((n, g) => n + g.length, 0);
  const chosen = groups.flat().slice(0, PUSH_MAX_ITEMS);
  return { items: chosen.sort((a, b) => a.at - b.at), total, dropped: total - chosen.length };
}

export function buildPushSchedule(input: PushInput): PushItem[] {
  return buildPushSchedulePlan(input).items;
}
