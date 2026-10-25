import { addDaysToKey } from "@/lib/week";
import type { ReviewCard } from "./srs";
import type { JournalEntry } from "./yStudy";

/**
 * Statystyki działu Praca (N4) — czyste funkcje nad stanem Nauki: trafność z kart
 * powtórek (`seen`/`right`), dni nauki ze `studyDays`, wpisy z dziennika.
 * Bez importu materiału — pytania i tematy podaje wywołujący.
 */

export interface TopicAccuracy {
  topic: string;
  seen: number;
  right: number;
  /** 0–100, zaokrąglone; `null` = jeszcze bez odpowiedzi. */
  percent: number | null;
}

const pct = (right: number, seen: number) => (seen > 0 ? Math.round((right / seen) * 100) : null);

/** Trafność ogółem z kart powtórek. */
export function overallAccuracy(review: Readonly<Record<string, ReviewCard>>): { seen: number; right: number; percent: number | null } {
  let seen = 0, right = 0;
  for (const c of Object.values(review)) { seen += c.seen; right += c.right; }
  return { seen, right, percent: pct(right, seen) };
}

/**
 * Trafność per temat, od najsłabszego (tematy bez odpowiedzi na końcu, w kolejności
 * podanej). `questions` — id pytania → temat.
 */
export function accuracyByTopic(
  review: Readonly<Record<string, ReviewCard>>,
  questions: readonly { id: string; topic: string }[],
  topics: readonly string[],
): TopicAccuracy[] {
  const sums = new Map<string, { seen: number; right: number }>(topics.map((t) => [t, { seen: 0, right: 0 }]));
  for (const q of questions) {
    const c = review[q.id];
    const s = sums.get(q.topic);
    if (!c || !s) continue;
    s.seen += c.seen;
    s.right += c.right;
  }
  const rows = topics.map((topic) => { const s = sums.get(topic)!; return { topic, ...s, percent: pct(s.right, s.seen) }; });
  const answered = rows.filter((r) => r.percent !== null).sort((a, b) => a.percent! - b.percent! || b.seen - a.seen);
  return [...answered, ...rows.filter((r) => r.percent === null)];
}

/** Pytania z największą liczbą pomyłek (co najmniej jedna), najwyżej `limit`. */
export function hardestQuestions(review: Readonly<Record<string, ReviewCard>>, limit = 5): { id: string; lapses: number; seen: number }[] {
  return Object.entries(review)
    .filter(([, c]) => c.lapses > 0)
    .map(([id, c]) => ({ id, lapses: c.lapses, seen: c.seen }))
    .sort((a, b) => b.lapses - a.lapses || a.seen - b.seen || (a.id < b.id ? -1 : 1))
    .slice(0, limit);
}

/** Dzień tygodnia 0 = poniedziałek dla klucza „2026-10-15”. */
function weekdayMon(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/**
 * Siatka dni nauki: `weeks` tygodni (poniedziałek–niedziela), ostatni z dzisiejszym dniem.
 * Kolumna = tydzień, wiersz = dzień tygodnia; dni po dzisiejszym — `future`.
 */
export function studyDaysGrid(days: readonly string[], today: string, weeks = 12): { key: string; studied: boolean; future: boolean }[][] {
  const set = new Set(days);
  const start = addDaysToKey(today, -weekdayMon(today) - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const key = addDaysToKey(start, w * 7 + d);
      return { key, studied: set.has(key), future: key > today };
    }),
  );
}

/** Ile różnych dni nauki w ostatnich `span` dniach (z dzisiejszym). */
export function daysInLast(days: readonly string[], today: string, span = 30): number {
  const from = addDaysToKey(today, -(span - 1));
  return days.filter((d) => d >= from && d <= today).length;
}

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS_PL = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

/** Wpisy z budowy w ostatnich `months` miesiącach (z bieżącym), od najstarszego; puste miesiące z zerem. */
export function entriesByMonth(journal: readonly JournalEntry[], now: number, months = 6): { month: string; label: string; count: number }[] {
  const d = new Date(now);
  const rows = Array.from({ length: months }, (_, i) => {
    const m = new Date(d.getFullYear(), d.getMonth() - (months - 1 - i), 1);
    return { month: `${m.getFullYear()}-${pad(m.getMonth() + 1)}`, label: MONTHS_PL[m.getMonth()], count: 0 };
  });
  const idx = new Map(rows.map((r, i) => [r.month, i]));
  for (const e of journal) {
    const t = new Date(e.at);
    const i = idx.get(`${t.getFullYear()}-${pad(t.getMonth() + 1)}`);
    if (i !== undefined) rows[i].count += 1;
  }
  return rows;
}

/**
 * Wpisy per budowa, od największej liczby; budowa z nazwy we wpisie (aktualnej z karty —
 * `sanitizeStudy` już ją podstawia). Najwyżej `limit`, reszta zsumowana jako „Pozostałe”.
 */
export function entriesBySite(journal: readonly JournalEntry[], limit = 6): { site: string; count: number; open: number }[] {
  const by = new Map<string, { count: number; open: number }>();
  for (const e of journal) {
    const site = e.site.trim() || "Bez budowy";
    const r = by.get(site) ?? { count: 0, open: 0 };
    r.count += 1;
    if (e.kind === "problem" && e.resolved === undefined) r.open += 1;
    by.set(site, r);
  }
  const rows = [...by].map(([site, r]) => ({ site, ...r })).sort((a, b) => b.count - a.count || a.site.localeCompare(b.site, "pl"));
  if (rows.length <= limit) return rows;
  const rest = rows.slice(limit - 1);
  return [
    ...rows.slice(0, limit - 1),
    { site: "Pozostałe", count: rest.reduce((n, r) => n + r.count, 0), open: rest.reduce((n, r) => n + r.open, 0) },
  ];
}

/** Próg podpowiedzi „Umiem” (§4.1): co najmniej tyle procent trafień i tyle odpowiedzi. */
export const SUGGEST_DONE_PERCENT = 90;
export const SUGGEST_DONE_MIN_SEEN = 10;

/** Czy temat z tą trafnością wygląda na opanowany — tylko podpowiedź, nie przeniesienie. */
export function suggestsDone(row: { percent: number | null; seen: number }): boolean {
  return row.percent !== null && row.percent >= SUGGEST_DONE_PERCENT && row.seen >= SUGGEST_DONE_MIN_SEEN;
}
