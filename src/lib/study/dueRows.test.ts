import { describe, expect, it } from "vitest";
import { studyDueRows } from "./dueRows";
import type { StudyReminder } from "./reminders";

describe("studyDueRows", () => {
  it("serwis i zamówienie mają budowę i pozycje; problemy nie mają budowy", () => {
    const reminders: StudyReminder[] = [
      { kind: "service-due", siteId: "s1", site: "Kopernika", items: ["przegląd kotła"] },
      { kind: "late-order", siteId: "s2", site: "Lipowa", items: ["kolano 16"] },
      { kind: "stale-problems", count: 2, oldest: 0 },
    ];
    const rows = studyDueRows(reminders);
    expect(rows.map((r) => r.kind)).toEqual(["service", "order", "problems"]);
    expect(rows[0]).toMatchObject({ key: "service:s1", title: "Serwis: Kopernika", detail: "przegląd kotła", siteId: "s1" });
    expect(rows[1].detail).toContain("kolano 16");
    expect(rows[2]).toMatchObject({ key: "problems", siteId: null });
    expect(rows[2].title).toBe("2 otwarte problemy");
  });

  it("pomija protokół próby (to nie termin)", () => {
    expect(studyDueRows([{ kind: "no-test", siteId: "s1", site: "Kopernika" }])).toEqual([]);
  });

  it("pusta lista przypomnień daje pusty wynik", () => {
    expect(studyDueRows([])).toEqual([]);
  });

  it("liczba problemów odmienia się po polsku", () => {
    expect(studyDueRows([{ kind: "stale-problems", count: 1, oldest: 0 }])[0].title).toBe("1 otwarty problem");
    expect(studyDueRows([{ kind: "stale-problems", count: 5, oldest: 0 }])[0].title).toBe("5 otwartych problemów");
  });
});

describe("próba przed zakryciem na Dziś (U1)", () => {
  it("przypomnienie z etapów trafia na Dziś jako wiersz „test” z odnośnikiem do budowy", () => {
    expect(studyDueRows([{ kind: "pre-cover-test", siteId: "k1", site: "Lipowa 5" }])).toEqual([
      { key: "test:k1", kind: "test", title: "Próba przed zakryciem: Lipowa 5", detail: "instalacja odhaczona, a protokołu próby nie ma", siteId: "k1" },
    ]);
  });
});
