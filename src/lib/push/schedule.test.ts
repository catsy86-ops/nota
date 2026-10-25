import { describe, expect, it } from "vitest";
import { EMPTY_SHIFT_DATA, type ShiftData } from "@/lib/shifts/model";
import type { JournalEntry } from "@/lib/study/yStudy";
import { buildPushSchedule, outsideQuietHours, PUSH_HORIZON_DAYS, type PushNote } from "./schedule";

const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).getTime();
const note = (over: Partial<PushNote> = {}): PushNote => ({ id: "n1", title: "Zadzwonić do hurtowni", content: "", reminder: null, ...over });
const entry = (over: Partial<JournalEntry> = {}): JournalEntry =>
  ({ id: "e1", at: at(14, 9), kind: "ok", topic: null, text: "Montaż", site: "Lipowa 5", checked: [], images: [], ...over });

// 2026-10-14 to środa, 16 — piątek.
const WED_NOON = at(14, 12);

describe("buildPushSchedule — notatki", () => {
  it("jednorazowe przypomnienie w przyszłości, przeszłe pomija", () => {
    const items = buildPushSchedule({ now: WED_NOON, notes: [note({ reminder: at(14, 15) }), note({ id: "n2", reminder: at(14, 11) })] });
    expect(items).toEqual([{ key: `n:n1:${at(14, 15)}`, at: at(14, 15), title: "Zadzwonić do hurtowni", body: "Przypomnienie z G", url: "/notatka/n1", snooze: true }]);
  });

  it("seria: kolejne terminy w horyzoncie", () => {
    const items = buildPushSchedule({ now: WED_NOON, notes: [note({ reminder: at(14, 15), reminderRepeat: "daily" })] });
    expect(items).toHaveLength(PUSH_HORIZON_DAYS);
    expect(items[1].at).toBe(at(15, 15));
  });

  it("notatka prywatna bez tytułu i treści, bez tytułu — pierwsza linia treści", () => {
    const [locked, untitled] = buildPushSchedule({ now: WED_NOON, notes: [
      note({ reminder: at(14, 13), locked: true }),
      note({ id: "n2", title: " ", content: "\n  Kupić złączki\nreszta", reminder: at(14, 14) }),
    ] });
    expect(locked.title).toBe("Przypomnienie z notatki prywatnej");
    expect(locked.body).not.toContain("hurtowni");
    expect(untitled.title).toBe("Kupić złączki");
  });
});

describe("buildPushSchedule — Grafik i raporty", () => {
  const shifts: ShiftData = { ...EMPTY_SHIFT_DATA, days: { "2026-10-15": { type: "b" } } };

  it("wieczorem przed dniem ze zmianą", () => {
    const items = buildPushSchedule({ now: WED_NOON, notes: [], shifts, eveningTime: "20:00" });
    expect(items.map((i) => i.key)).toEqual(["e:2026-10-15"]);
    expect(items[0].at).toBe(at(14, 20));
    expect(buildPushSchedule({ now: WED_NOON, notes: [], shifts, eveningTime: "20:00", eveningNudged: "2026-10-15" })).toEqual([]);
    expect(buildPushSchedule({ now: WED_NOON, notes: [], shifts, eveningTime: null })).toEqual([]);
  });

  it("raport dnia tylko z dzisiejszymi wpisami i raz dziennie", () => {
    const items = buildPushSchedule({ now: WED_NOON, notes: [], journal: [entry()] });
    expect(items.map((i) => i.key)).toEqual(["rd:2026-10-14", "rw:2026-10-12"]);
    expect(items[0]).toMatchObject({ at: at(14, 17), title: "Raport dnia gotowy", url: "/praca?raport=dzis" });
    expect(buildPushSchedule({ now: WED_NOON, notes: [], journal: [entry()], reportNudged: "2026-10-14", weekReportNudged: "2026-10-12" })).toEqual([]);
  });

  it("w piątek raport tygodnia zamiast dnia", () => {
    const items = buildPushSchedule({ now: at(16, 10), notes: [], journal: [entry({ at: at(16, 8) }), entry({ id: "e2", at: at(14, 8), site: "Polna 2" })] });
    expect(items.map((i) => i.key)).toEqual(["rw:2026-10-12"]);
    expect(items[0].url).toBe("/praca?raport=tydzien-wszystkie");
  });
});

describe("buildPushSchedule — Praca", () => {
  it("problem otwarty od 3 dni, rozwiązany nie", () => {
    const items = buildPushSchedule({ now: WED_NOON, notes: [], journal: [
      entry({ id: "p1", kind: "problem", at: at(13, 10), text: "Przeciek na zaworze" }),
      entry({ id: "p2", kind: "problem", at: at(13, 11), resolved: at(13, 12) }),
    ] });
    const p = items.filter((i) => i.key.startsWith("p:"));
    expect(p).toEqual([expect.objectContaining({ key: "p:p1", at: at(16, 10), body: "Lipowa 5: Przeciek na zaworze" })]);
  });

  it("materiał zamówiony ponad 3 dni — bez archiwalnych budów", () => {
    const shortage = { id: "s1", text: "Kolano 16", qty: "4", status: "ordered" as const, at: at(13, 9), changed: at(13, 23) };
    const items = buildPushSchedule({ now: WED_NOON, notes: [], sites: {
      a: { id: "a", name: "Lipowa 5", shortages: [shortage] },
      b: { id: "b", name: "Stara", archived: 1, shortages: [{ ...shortage, id: "s2" }] },
    } });
    // Próg wypada o 23:00 — przesunięty na 7:00 następnego dnia.
    expect(items).toEqual([expect.objectContaining({ key: `o:s1:${at(13, 23)}`, at: at(17, 7), body: expect.stringContaining("Kolano 16 (4)") })]);
  });
});

describe("outsideQuietHours", () => {
  it("noc przesuwa na 7:00, dzień zostaje", () => {
    expect(outsideQuietHours(at(14, 12))).toBe(at(14, 12));
    expect(outsideQuietHours(at(14, 3))).toBe(at(14, 7));
    expect(outsideQuietHours(at(14, 22))).toBe(at(15, 7));
  });
});

describe("push: dostawa dziś (2.2)", () => {
  const at = (d: number, h: number) => new Date(2026, 9, d, h).getTime();

  it("rano w dniu dostawy, zanim zamówienie się spóźni", () => {
    const sites = { s: { id: "s", name: "Lipowa", shortages: [{ id: "a", text: "Kolano 16", qty: "3", status: "ordered", at: at(10, 8), changed: at(10, 8), due: at(15, 12) }] } };
    const items = buildPushSchedule({ now: at(14, 20), notes: [], sites } as never);
    expect(items).toContainEqual({ key: `d:a:${at(15, 12)}`, at: at(15, 7), title: "Dostawa dziś: Lipowa", body: "Kolano 16 (3)", url: "/praca?budowa=s" });
  });
});
