import { describe, expect, it } from "vitest";
import { backupStale, daySummary } from "./endDay";
import type { JournalEntry } from "./yStudy";

const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m);
const e = (id: string, when: Date, site = "Lipowa 5"): JournalEntry =>
  ({ id, at: when.getTime(), kind: "ok", topic: null, text: "Montaż", site, checked: [], images: [] });

describe("daySummary", () => {
  it("pusty dzień: zera i brak godzin", () => {
    const s = daySummary([e("a", at(13, 9))], at(14, 18).getTime());
    expect(s).toMatchObject({ entries: 0, sites: 0, firstAt: null, lastAt: null, spanMinutes: 0 });
  });

  it("liczy wpisy i budowy tylko z dzisiaj", () => {
    const j = [e("a", at(13, 9)), e("b", at(14, 7, 40)), e("c", at(14, 15, 10), "Polna 2"), e("d", at(14, 12))];
    const s = daySummary(j, at(14, 18).getTime());
    expect(s.entries).toBe(3);
    expect(s.sites).toBe(2);
    expect(s.firstAt).toBe(at(14, 7, 40).getTime());
    expect(s.lastAt).toBe(at(14, 15, 10).getTime());
    expect(s.spanMinutes).toBe(7 * 60 + 30);
  });

  it("jeden wpis: rozpiętość zero", () => {
    expect(daySummary([e("a", at(14, 9))], at(14, 18).getTime()).spanMinutes).toBe(0);
  });
});

describe("backupStale", () => {
  const now = at(14, 18).getTime();
  const day = 24 * 60 * 60 * 1000;

  it("brak kopii to zaległość", () => {
    expect(backupStale(0, now)).toBe(true);
  });

  it("świeża kopia nie, starsza niż 3 dni tak", () => {
    expect(backupStale(now - 2 * day, now)).toBe(false);
    expect(backupStale(now - 3 * day, now)).toBe(false);
    expect(backupStale(now - 3 * day - 1, now)).toBe(true);
  });
});
