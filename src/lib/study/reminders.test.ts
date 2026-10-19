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

describe("przypomnienie: zamówione, a nie dojechało", () => {
  const card = (id: string, shortages: NonNullable<import("./sites").SiteCard["shortages"]>, extra: Partial<import("./sites").SiteCard> = {}) =>
    ({ id, name: id === "k1" ? "Lipowa 5" : "Polna 2", address: "", investor: "", created: 0, shortages, ...extra });
  const item = (id: string, text: string, status: "missing" | "ordered" | "delivered", changedDaysAgo: number) =>
    ({ id, text, qty: "", status, at: NOW - 10 * DAY, changed: NOW - changedDaysAgo * DAY });

  it("zamówione ponad 3 dni temu, niedostarczone — jedno przypomnienie na budowę z nazwami", () => {
    const sites = {
      k1: card("k1", [item("a", "Klej PCV", "ordered", 4), item("b", "Rura PEX 16", "ordered", 5), item("c", "Otulina", "ordered", 1), item("d", "Kolano", "delivered", 9)]),
      k2: card("k2", [item("e", "Syfon", "missing", 9)]),
    };
    expect(studyReminders([], NOW, sites)).toEqual([{ kind: "late-order", siteId: "k1", site: "Lipowa 5", items: ["Klej PCV", "Rura PEX 16"] }]);
  });

  it("budowa w archiwum i świeże zamówienia — bez przypomnienia", () => {
    expect(studyReminders([], NOW, { k1: card("k1", [item("a", "Klej PCV", "ordered", 9)], { archived: NOW }) })).toEqual([]);
    expect(studyReminders([], NOW, { k1: card("k1", [item("a", "Klej PCV", "ordered", 2)]) })).toEqual([]);
  });

  it("z datą dostawy: zaległe dopiero po końcu dnia dostawy, niezależnie od daty zmiany", () => {
    const withDue = (due: number, changedDaysAgo: number) => ({ ...item("a", "Klej PCV", "ordered", changedDaysAgo), due });
    // Dostawa wczoraj: zaległa już dziś rano, choć zamówienie świeże.
    expect(studyReminders([], NOW, { k1: card("k1", [withDue(NOW - DAY, 1)]) })).toHaveLength(1);
    // Dostawa dziś: jeszcze nie zaległa, mimo że zamówione dawno.
    expect(studyReminders([], NOW, { k1: card("k1", [withDue(NOW, 9)]) })).toEqual([]);
  });

  it("bez daty zmiany liczy się od dopisania", () => {
    const old = { id: "a", text: "Klej PCV", qty: "", status: "ordered" as const, at: NOW - 5 * DAY };
    expect(studyReminders([], NOW, { k1: card("k1", [old]) })).toHaveLength(1);
  });
});
