import { describe, expect, it } from "vitest";
import { REMINDER_PROBLEM_DAYS, studyReminders } from "./reminders";
import type { JournalEntry } from "./yStudy";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 16, 12).getTime();

const entry = (p: Partial<JournalEntry>): JournalEntry => ({
  id: p.id ?? Math.random().toString(36).slice(2),
  at: NOW,
  kind: "ok",
  topic: null,
  text: "",
  site: "",
  checked: [],
  images: [],
  ...p,
});

describe("przypomnienia dziennika", () => {
  it("bez wpisów nie ma przypomnień", () => {
    expect(studyReminders([], NOW)).toEqual([]);
  });

  it("problem otwarty starszy niż 3 dni przypomina; świeży i rozwiązany — nie", () => {
    const old = NOW - (REMINDER_PROBLEM_DAYS + 1) * DAY;
    const r = studyReminders([
      entry({ kind: "problem", at: old, text: "stara rura" }),
      entry({ kind: "problem", at: NOW - DAY, text: "świeży" }),
      entry({ kind: "problem", at: old, resolved: NOW, text: "rozwiązany" }),
    ], NOW);
    expect(r).toEqual([{ kind: "stale-problems", count: 1, oldest: old }]);
  });

  it("dokładnie 3 dni to jeszcze nie przypomnienie", () => {
    const r = studyReminders([entry({ kind: "problem", at: NOW - REMINDER_PROBLEM_DAYS * DAY })], NOW);
    expect(r).toEqual([]);
  });

  it("budowa z kształtkami bez protokołu → przypomnienie o próbie; z protokołem — nie", () => {
    const fittings = [{ kind: "kolano", count: 2 }] as unknown as JournalEntry["fittings"];
    const lack = studyReminders([entry({ siteId: "lipowa", site: "Lipowa 3", fittings })], NOW);
    expect(lack).toEqual([{ kind: "no-test", siteId: "lipowa", site: "Lipowa 3" }]);

    const done = studyReminders([
      entry({ siteId: "lipowa", site: "Lipowa 3", fittings }),
      entry({ siteId: "lipowa", site: "Lipowa 3", test: { medium: "air", bar: 6, minutes: 30, drop: 0, ok: true } }),
    ], NOW);
    expect(done).toEqual([]);
  });

  it("wpis z tematu próby też liczy się jako montaż; próba w innej budowie nie zdejmuje przypomnienia", () => {
    const r = studyReminders([
      entry({ siteId: "a", site: "A", topic: "proba-kan" }),
      entry({ siteId: "b", site: "B", test: { medium: "sewer", bar: null, minutes: 20, drop: null, ok: true } }),
    ], NOW);
    expect(r).toEqual([{ kind: "no-test", siteId: "a", site: "A" }]);
  });

  it("wpisy bez budowy nie dają przypomnienia o próbie", () => {
    const r = studyReminders([entry({ site: "", topic: "proba-wody" })], NOW);
    expect(r).toEqual([]);
  });

  it("nazwa budowy z najnowszego wpisu", () => {
    const r = studyReminders([
      entry({ siteId: "x", site: "Stara nazwa", at: NOW - 2 * DAY, topic: "proba-wody" }),
      entry({ siteId: "x", site: "Nowa nazwa", at: NOW - DAY, topic: "proba-wody" }),
    ], NOW);
    expect(r).toEqual([{ kind: "no-test", siteId: "x", site: "Nowa nazwa" }]);
  });
});
