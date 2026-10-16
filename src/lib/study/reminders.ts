import { TEST_TOPICS } from "./pressureTest";
import { entrySiteId, type SiteCard } from "./sites";
import type { JournalEntry } from "./yStudy";

/** Problem otwarty dłużej niż tyle dni dostaje przypomnienie (plan Nauki i Dziennika, 2026-10-15). */
export const REMINDER_PROBLEM_DAYS = 3;
/** Materiał „zamówiony” dłużej niż tyle dni, a wciąż nie „dostarczony” — przypomnienie przy budowie. */
export const REMINDER_ORDER_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type StudyReminder =
  | { kind: "stale-problems"; count: number; oldest: number }
  | { kind: "no-test"; siteId: string; site: string }
  | { kind: "late-order"; siteId: string; site: string; items: string[] };

/**
 * Przypomnienia do dziennika:
 * - są problemy otwarte dłużej niż `REMINDER_PROBLEM_DAYS` dni (od momentu wpisu problemu),
 * - budowa ma montaż (wpis z kształtkami albo z tematu próby szczelności), a żaden jej wpis nie ma
 *   protokołu próby — a zakrycie grozi przed próbą, nie po niej,
 * - braki materiału budowy (`SiteCard.shortages`) „zamówione” ponad `REMINDER_ORDER_DAYS` dni temu
 *   i wciąż niedostarczone — pora zadzwonić do hurtowni (budowy w archiwum pomijamy).
 *
 * Czysta funkcja: przypomnienie znika samo, gdy warunek przestaje być prawdziwy (problem rozwiązany,
 * protokół dopisany). Bez wpisów z budowy — brak przypomnień.
 */
export function studyReminders(
  journal: readonly JournalEntry[],
  now: number = Date.now(),
  siteCards: Readonly<Record<string, Pick<SiteCard, "id" | "name" | "archived" | "shortages">>> = {},
): StudyReminder[] {
  const out: StudyReminder[] = [];

  const stale = journal.filter((e) => e.kind === "problem" && e.resolved === undefined && now - e.at > REMINDER_PROBLEM_DAYS * DAY_MS);
  if (stale.length > 0) {
    out.push({ kind: "stale-problems", count: stale.length, oldest: Math.min(...stale.map((e) => e.at)) });
  }

  // Budowy po id; nazwa z najnowszego wpisu (może być zmieniona po drodze).
  const sites = new Map<string, { site: string; at: number; install: boolean; tested: boolean }>();
  for (const e of journal) {
    const id = entrySiteId(e);
    if (id === "") continue;
    const s = sites.get(id) ?? { site: e.site.trim(), at: e.at, install: false, tested: false };
    if (e.at >= s.at) { s.site = e.site.trim(); s.at = e.at; }
    if ((e.fittings?.length ?? 0) > 0 || (e.topic !== null && TEST_TOPICS.has(e.topic))) s.install = true;
    if (e.test) s.tested = true;
    sites.set(id, s);
  }
  for (const [siteId, s] of sites) {
    if (s.install && !s.tested) out.push({ kind: "no-test", siteId, site: s.site });
  }

  for (const card of Object.values(siteCards)) {
    if (card.archived !== undefined) continue;
    const late = (card.shortages ?? []).filter((x) => x.status === "ordered" && now - (x.changed ?? x.at) > REMINDER_ORDER_DAYS * DAY_MS);
    if (late.length > 0) out.push({ kind: "late-order", siteId: card.id, site: card.name, items: late.map((x) => x.text) });
  }

  return out;
}
