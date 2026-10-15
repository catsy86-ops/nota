import { describe, expect, it } from "vitest";
import { cleanCard, dueIds, EASE_MIN, INTERVAL_MAX, reviewCard, type ReviewCard } from "./srs";

const D = "2026-10-15";

describe("srs — SM-2 lite z oceną automatyczną", () => {
  it("dobre odpowiedzi: 1 dzień, 3 dni, potem odstęp × łatwość", () => {
    let c = reviewCard(undefined, true, D);
    expect(c).toMatchObject({ reps: 1, interval: 1, due: "2026-10-16" });
    c = reviewCard(c, true, "2026-10-16");
    expect(c).toMatchObject({ reps: 2, interval: 3, due: "2026-10-19" });
    c = reviewCard(c, true, "2026-10-19");
    expect(c).toMatchObject({ reps: 3, interval: 8, due: "2026-10-27" });
  });

  it("błąd: od nowa jutro, łatwość w dół (nie poniżej minimum), licznik pomyłek", () => {
    let c: ReviewCard | undefined;
    for (let i = 0; i < 10; i++) c = reviewCard(c, false, D);
    expect(c).toMatchObject({ reps: 0, interval: 1, due: "2026-10-16", ease: EASE_MIN, lapses: 10 });
  });

  it("druga dobra odpowiedź tego samego dnia nie wydłuża odstępu", () => {
    const c = reviewCard(undefined, true, D);
    expect(reviewCard(c, true, D)).toBe(c);
  });

  it("odstęp ma sufit", () => {
    const c: ReviewCard = { reps: 9, interval: 150, ease: 2.5, due: D, last: "2026-01-01", lapses: 0 };
    expect(reviewCard(c, true, D).interval).toBe(INTERVAL_MAX);
  });

  it("dueIds: tylko należne, najpierw najbardziej zaległe, tylko znane pytania", () => {
    const card = (due: string): ReviewCard => ({ reps: 1, interval: 1, ease: 2.5, due, last: due, lapses: 0 });
    const reviews = { a: card("2026-10-15"), b: card("2026-10-10"), c: card("2026-10-16"), x: card("2026-10-01") };
    expect(dueIds(reviews, D)).toEqual(["x", "b", "a"]);
    expect(dueIds(reviews, D, new Set(["a", "b", "c"]))).toEqual(["b", "a"]);
  });

  it("cleanCard odrzuca śmieci i przycina wartości", () => {
    expect(cleanCard(null)).toBeNull();
    expect(cleanCard({ due: "jutro", last: D })).toBeNull();
    expect(cleanCard({ due: D, last: D, ease: 0.1, interval: 9999, reps: -3 })).toEqual({ reps: 0, interval: INTERVAL_MAX, ease: EASE_MIN, due: D, last: D, lapses: 0 });
  });
});
