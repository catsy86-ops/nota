import { describe, expect, it } from "vitest";
import { cleanCard, dueIds, EASE_MIN, INTERVAL_MAX, reviewCard, type ReviewCard } from "./srs";

const D = "2026-10-15";
const ahead = (days: number) => {
  const d = new Date(2026, 9, 15 + days, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

describe("srs — FSRS (P-6) z dwoma wynikami", () => {
  it("pierwsza dobra odpowiedź: powtórka w przyszłości, karta w powtórkach", () => {
    const c = reviewCard(undefined, true, D);
    expect(c).toMatchObject({ reps: 1, right: 1, seen: 1, lapses: 0, state: 2 });
    expect(c.due > D).toBe(true);
    expect(c.stability).toBeGreaterThan(0);
  });

  it("kolejne dobre odpowiedzi wydłużają odstęp", () => {
    let c = reviewCard(undefined, true, D);
    const intervals = [c.interval];
    for (let i = 0; i < 4; i++) {
      c = reviewCard(c, true, c.due);
      intervals.push(c.interval);
    }
    expect(intervals[1]).toBeGreaterThan(intervals[0]);
    expect(intervals.every((x, i) => i === 0 || x >= intervals[i - 1])).toBe(true);
    expect(c.interval).toBeLessThanOrEqual(INTERVAL_MAX);
  });

  it("odstęp ma sufit", () => {
    let c: ReviewCard | undefined;
    let day = D;
    for (let i = 0; i < 25; i++) {
      c = reviewCard(c, true, day);
      day = c.due;
    }
    expect(c!.interval).toBeLessThanOrEqual(INTERVAL_MAX);
  });

  it("błąd: powtórka następnego dnia, licznik pomyłek i brak dobrych z rzędu", () => {
    const good = reviewCard(reviewCard(undefined, true, D), true, ahead(1));
    const missed = reviewCard(good, false, good.due);
    expect(missed).toMatchObject({ reps: 0, lapses: 1, right: good.right, seen: good.seen + 1 });
    expect(missed.interval).toBeLessThan(good.interval);
  });

  it("wielokrotne pomyłki podnoszą trudność, dobre ją obniżają", () => {
    let c: ReviewCard | undefined;
    for (let i = 0; i < 6; i++) c = reviewCard(c, false, D);
    const hard = c!.difficulty!;
    const eased = reviewCard(c, true, c!.due).difficulty!;
    expect(hard).toBeGreaterThan(5);
    expect(eased).toBeLessThan(hard);
  });

  it("druga dobra odpowiedź tego samego dnia nie zmienia terminu, ale liczy się do trafności", () => {
    const c = reviewCard(undefined, true, D);
    const again = reviewCard(c, true, D);
    expect(again).toMatchObject({ reps: 1, interval: c.interval, due: c.due, seen: 2, right: 2 });
    expect(reviewCard(again, false, D)).toMatchObject({ seen: 3, right: 2, lapses: 1 });
  });

  it("ten sam wejściowy stan daje ten sam wynik (bez losowości — dane synchronizują się przez Yjs)", () => {
    expect(reviewCard(undefined, true, D)).toEqual(reviewCard(undefined, true, D));
  });

  it("karta sprzed FSRS: stabilność z dotychczasowego odstępu, trudna (niska łatwość) wraca szybciej", () => {
    const legacy = (ease: number): ReviewCard => ({ reps: 3, interval: 8, ease, due: D, last: ahead(-8), lapses: 0, seen: 3, right: 3 });
    const hard = reviewCard(legacy(EASE_MIN), true, D);
    const easy = reviewCard(legacy(5), true, D);
    expect(hard.stability).toBeDefined();
    expect(hard.state).toBe(2);
    expect(hard.interval).toBeLessThan(easy.interval);
  });

  it("dueIds: tylko należne, najpierw najbardziej zaległe, tylko znane pytania", () => {
    const card = (due: string): ReviewCard => ({ reps: 1, interval: 1, ease: 2.5, due, last: due, lapses: 0, seen: 1, right: 1 });
    const reviews = { a: card("2026-10-15"), b: card("2026-10-10"), c: card("2026-10-16"), x: card("2026-10-01") };
    expect(dueIds(reviews, D)).toEqual(["x", "b", "a"]);
  });

  it("cleanCard odrzuca śmieci i przycina wartości", () => {
    expect(cleanCard(null)).toBeNull();
    expect(cleanCard({ due: "jutro", last: D })).toBeNull();
    expect(cleanCard({ due: D, last: D, ease: 0.1, interval: 9999, reps: -3 })).toEqual({ reps: 0, interval: INTERVAL_MAX, ease: EASE_MIN, due: D, last: D, lapses: 0, seen: 0, right: 0 });
    // Karta sprzed N4: liczniki z pomyłek i dobrych z rzędu.
    expect(cleanCard({ due: D, last: D, reps: 2, lapses: 1 })).toMatchObject({ seen: 3, right: 2 });
  });

  it("cleanCard zachowuje pola FSRS tylko w komplecie i przycina je", () => {
    const full = cleanCard({ due: D, last: D, stability: 4.2, difficulty: 6, state: 2 });
    expect(full).toMatchObject({ stability: 4.2, difficulty: 6, state: 2 });
    expect(cleanCard({ due: D, last: D, stability: 4.2 })).not.toHaveProperty("stability");
    expect(cleanCard({ due: D, last: D, stability: -3, difficulty: 99, state: 9 })).toMatchObject({ stability: 0, difficulty: 10, state: 3 });
  });
});
