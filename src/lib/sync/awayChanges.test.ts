import { describe, expect, it } from "vitest";
import { AWAY_COLLECT_MS, AWAY_GAP_MS, awayTitle, changedSince, createAwayTracker } from "./awayChanges";

const note = (id: string, updatedAt: number, extra: object = {}) => ({ id, title: `T${id}`, updatedAt, ...extra });

describe("co się zmieniło, gdy mnie nie było (Q4.2)", () => {
  it("changedSince: nowsze i nowe, bez prywatnych i kosza, najnowsze pierwsze", () => {
    const base = new Map([["a", 1], ["b", 5], ["p", 1]]);
    const out = changedSince(base, [note("a", 3), note("b", 5), note("c", 9), note("p", 7, { locked: true }), note("t", 8, { trashed: true })]);
    expect(out.map((n) => n.id)).toEqual(["c", "a"]);
  });

  it("awayTitle odmienia", () => {
    expect(awayTitle(1)).toBe("1 notatka zmieniona na innym urządzeniu");
    expect(awayTitle(3)).toBe("3 notatki zmienione na innym urządzeniu");
    expect(awayTitle(5)).toBe("5 notatek zmienionych na innym urządzeniu");
  });

  it("pierwsza paczka zbiera zmiany przez chwilę i zgłasza raz; kolejna bez przerwy już nie", () => {
    let t = 0;
    let notes = [note("a", 1), note("b", 1)];
    const timers: { fn: () => void; at: number }[] = [];
    const reports: string[][] = [];
    const tracker = createAwayTracker({
      notes: () => notes, now: () => t,
      schedule: (fn, ms) => { timers.push({ fn, at: t + ms }); },
      report: (c) => reports.push(c.map((n) => n.id)),
    });
    tracker.start();
    t = 1000; notes = [note("a", 900), note("b", 1)];
    expect(tracker.onRemote()).toBe(true);
    t = 1500; notes = [note("a", 900), note("b", 1400)];
    expect(tracker.onRemote()).toBe(true);
    t = 1000 + AWAY_COLLECT_MS; timers.shift()!.fn();
    expect(reports).toEqual([["b", "a"]]);
    t += 60_000; notes = [note("a", t), note("b", 1400)];
    expect(tracker.onRemote()).toBe(false);
    t += AWAY_GAP_MS; notes = [note("a", t), note("b", 1400)];
    expect(tracker.onRemote()).toBe(true);
    timers.shift()!.fn();
    expect(reports).toEqual([["b", "a"], ["a"]]);
  });

  it("lokalna edycja odświeża wzorzec — nie liczy się jako zmiana z innego urządzenia", () => {
    let t = 0;
    let notes = [note("a", 1)];
    const timers: (() => void)[] = [];
    const reports: string[][] = [];
    const tracker = createAwayTracker({ notes: () => notes, now: () => t, schedule: (fn) => { timers.push(fn); }, report: (c) => reports.push(c.map((n) => n.id)) });
    tracker.start();
    notes = [note("a", 50)];
    tracker.onLocal();
    timers.shift()!();
    t = 100; notes = [note("a", 50), note("z", 90)];
    tracker.onRemote();
    timers.shift()!();
    expect(reports).toEqual([["z"]]);
  });
});
