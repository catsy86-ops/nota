import { describe, it, expect } from "vitest";
import { addDaysToKey } from "@/lib/week";
import { byMealOrder, cleanAmount, cleanGoals, cleanMeal, summarizeDay, summarizeRange, type Meal } from "./model";

const meal = (id: string, day: string, over: Partial<Meal> = {}): Meal => ({ id, day, text: id, created: 1, ...over });

describe("cleanMeal", () => {
  it("przycina opis, zachowuje poprawne wartości", () => {
    expect(cleanMeal({ id: "m1", day: "2026-10-20", text: "  Owsianka  ", kcal: 350.4, protein: 12, time: "08:15", created: 3 }))
      .toEqual({ id: "m1", day: "2026-10-20", text: "Owsianka", kcal: 350, protein: 12, time: "08:15", created: 3 });
  });

  it("odrzuca brak opisu, zły dzień i brak id", () => {
    expect(cleanMeal({ id: "m1", day: "2026-10-20", text: "   " })).toBeNull();
    expect(cleanMeal({ id: "m1", day: "20.10.2026", text: "x" })).toBeNull();
    expect(cleanMeal({ day: "2026-10-20", text: "x" })).toBeNull();
  });

  it("nieprawidłowe kcal, białko i godzina znikają, a posiłek zostaje", () => {
    const m = cleanMeal({ id: "m1", day: "2026-10-20", text: "x", kcal: -5, protein: "dużo", time: "25:00" });
    expect(m).not.toBeNull();
    expect(m).not.toHaveProperty("kcal");
    expect(m).not.toHaveProperty("protein");
    expect(m).not.toHaveProperty("time");
  });
});

describe("cleanAmount / cleanGoals", () => {
  it("liczby spoza zakresu są pomijane", () => {
    expect(cleanAmount(10_001, 10_000)).toBeUndefined();
    expect(cleanAmount(Number.NaN, 10)).toBeUndefined();
    expect(cleanAmount(0, 10)).toBe(0);
  });

  it("cele: zero i brak dają brak celu", () => {
    expect(cleanGoals({ kcal: 2200, protein: 0 })).toEqual({ kcal: 2200 });
    expect(cleanGoals(null)).toEqual({});
  });
});

describe("byMealOrder", () => {
  it("wg godziny; bez godziny na końcu dnia; potem czas dodania", () => {
    const list = [meal("bez", "d", { created: 1 }), meal("obiad", "d", { time: "13:00", created: 2 }), meal("sniad", "d", { time: "08:00", created: 3 })];
    expect(list.sort(byMealOrder).map((m) => m.id)).toEqual(["sniad", "obiad", "bez"]);
  });
});

describe("summarizeDay", () => {
  it("sumuje tylko podane wartości i liczy, ile ich jest", () => {
    const meals = [
      meal("a", "2026-10-20", { kcal: 500, protein: 30 }),
      meal("b", "2026-10-20", { kcal: 300 }),
      meal("c", "2026-10-20"),
      meal("d", "2026-10-19", { kcal: 9999 }),
    ];
    expect(summarizeDay(meals, "2026-10-20")).toEqual({ day: "2026-10-20", meals: 3, kcal: 800, kcalKnown: 2, protein: 30, proteinKnown: 1 });
  });
});

describe("summarizeRange", () => {
  it("zwraca dni od najstarszego do końca zakresu, także puste", () => {
    const meals = [meal("a", "2026-10-20", { kcal: 100 })];
    const days = summarizeRange(meals, "2026-10-20", 3, addDaysToKey);
    expect(days.map((d) => d.day)).toEqual(["2026-10-18", "2026-10-19", "2026-10-20"]);
    expect(days.map((d) => d.kcal)).toEqual([0, 0, 100]);
  });
});
