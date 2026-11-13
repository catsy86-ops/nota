import { describe, expect, it } from "vitest";
import { REMINDER_QUOTE_DAYS, studyReminders } from "./reminders";
import { studyDueRows } from "./dueRows";
import type { QuoteDoc } from "./quoteDoc";
import type { JobStatus } from "./jobs";

// Przypomnienie „wycena bez odpowiedzi” (plan wycen i klientów, 5.1).

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 10, 13, 12).getTime();
const cards = { a: { id: "a", name: "Lipowa 5" }, b: { id: "b", name: "Leśna 2", archived: 5 } };
const job = (status: JobStatus, doc?: QuoteDoc) => ({ status, ...(doc ? { doc } : {}) });
const run = (jobs: [string, ReturnType<typeof job>][], now = NOW) => studyReminders([], now, cards, new Map(jobs)).filter((r) => r.kind === "quote-silent");

describe("studyReminders: wycena bez odpowiedzi (5.1)", () => {
  it("wysłana ponad 7 dni temu, bez rozstrzygnięcia — przypomina z liczbą dni", () => {
    const r = run([["a", job("quote", { sentAt: NOW - 9 * DAY })]]);
    expect(r).toEqual([{ kind: "quote-silent", siteId: "a", site: "Lipowa 5", days: 9 }]);
  });

  it("granica: dokładnie 7 dni jeszcze nie, 7 dni i chwila już tak", () => {
    expect(REMINDER_QUOTE_DAYS).toBe(7);
    expect(run([["a", job("quote", { sentAt: NOW - 7 * DAY })]])).toEqual([]);
    expect(run([["a", job("quote", { sentAt: NOW - 7 * DAY - 1 })]])).toHaveLength(1);
  });

  it("przyjęta albo odrzucona po wysłaniu zamyka sprawę, ale ponowne wysłanie ją otwiera", () => {
    expect(run([["a", job("quote", { sentAt: NOW - 20 * DAY, acceptedAt: NOW - 18 * DAY })]])).toEqual([]);
    expect(run([["a", job("quote", { sentAt: NOW - 20 * DAY, rejectedAt: NOW - 19 * DAY })]])).toEqual([]);
    expect(run([["a", job("quote", { sentAt: NOW - 10 * DAY, rejectedAt: NOW - 19 * DAY })]])).toHaveLength(1);
  });

  it("nie przypomina dla szkicu, zlecenia już umówionego, zrobionego, zapłaconego ani budowy w archiwum lub bez karty", () => {
    const sent = { sentAt: NOW - 30 * DAY };
    expect(run([["a", job("quote", { number: "W/A/2026/001" })]])).toEqual([]);
    expect(run([["a", job("booked", sent)], ["x", job("quote", sent)]])).toEqual([]);
    expect(run([["a", job("done", sent)]])).toEqual([]);
    expect(run([["a", job("paid", sent)]])).toEqual([]);
    expect(run([["b", job("quote", sent)]])).toEqual([]);
    expect(run([["a", { status: "quote" }]])).toEqual([]);
  });

  it("bez zleceń (stare wywołanie z trzema argumentami) nic nie zmienia", () => {
    expect(studyReminders([], NOW, cards)).toEqual([]);
  });

  it("wiersz w Dziś i Terminach: tytuł z budową, opis z liczbą dni, odnośnik do karty budowy", () => {
    const rows = studyDueRows(run([["a", job("quote", { sentAt: NOW - 1 * DAY - 8 * DAY })]]));
    expect(rows).toEqual([{
      key: "quote:a", kind: "quote", title: "Wycena bez odpowiedzi: Lipowa 5",
      detail: "wysłana 9 dni temu (ponad 7) — zadzwoń do klienta", siteId: "a",
    }]);
    expect(studyDueRows(run([["a", job("quote", { sentAt: NOW - 8 * DAY })]]))[0].detail).toBe("wysłana 8 dni temu (ponad 7) — zadzwoń do klienta");
  });
});
