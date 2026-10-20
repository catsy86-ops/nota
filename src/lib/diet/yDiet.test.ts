import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { createYDiet, DIET_ORIGIN } from "./yDiet";
import type { Meal } from "./model";

const meal = (id: string, over: Partial<Meal> = {}): Meal => ({ id, day: "2026-10-20", text: id, created: 1, ...over });

describe("createYDiet", () => {
  it("dodaje posiłek i zwraca go w kolejności dnia i godziny", () => {
    const y = createYDiet(new Y.Doc());
    y.add(meal("obiad", { time: "13:00" }));
    y.add(meal("sniad", { time: "08:00" }));
    expect(y.get().map((m) => m.id)).toEqual(["sniad", "obiad"]);
  });

  it("nie dodaje duplikatu id", () => {
    const y = createYDiet(new Y.Doc());
    y.add(meal("a"));
    expect(y.add(meal("a"))).toBe(false);
  });

  it("usunięcie i cofnięcie zachowują id i godzinę", () => {
    const y = createYDiet(new Y.Doc());
    y.add(meal("a", { time: "09:00", kcal: 200 }));
    const prev = y.remove("a");
    expect(y.get()).toEqual([]);
    y.restore(prev!);
    expect(y.get()[0]).toMatchObject({ id: "a", time: "09:00", kcal: 200 });
  });

  it("dwa odczyty celów bez zmiany zwracają ten sam obiekt (inaczej React zapętla renderowanie)", () => {
    const y = createYDiet(new Y.Doc());
    y.setGoals({ kcal: 2000 });
    expect(y.getGoals()).toBe(y.getGoals());
    y.setGoals({ kcal: 2100 });
    expect(y.getGoals()).toEqual({ kcal: 2100 });
  });

  it("cele zapisują się w osobnej mapie i czytają jako czyste liczby", () => {
    const y = createYDiet(new Y.Doc());
    y.setGoals({ kcal: 2400, protein: 150 });
    expect(y.getGoals()).toEqual({ kcal: 2400, protein: 150 });
  });

  it("zmiany idą z origin Diety, a subskrybent dostaje powiadomienie", () => {
    const doc = new Y.Doc();
    const y = createYDiet(doc);
    const origins: unknown[] = [];
    doc.on("afterTransaction", (tr: Y.Transaction) => origins.push(tr.origin));
    let calls = 0;
    const off = y.subscribe(() => calls++);
    y.add(meal("a"));
    expect(origins).toContain(DIET_ORIGIN);
    expect(calls).toBeGreaterThan(0);
    off();
  });

  it("scalanie z kopii dodaje brakujące posiłki i cele tylko gdy ich nie ma, nic nie kasuje", () => {
    const y = createYDiet(new Y.Doc());
    y.add(meal("lokalny"));
    y.mergeDump({ meals: [meal("z-kopii"), { id: "zepsuty", day: "zle", text: "x" }], goals: { kcal: 2000 } });
    expect(y.get().map((m) => m.id).sort()).toEqual(["lokalny", "z-kopii"]);
    expect(y.getGoals()).toEqual({ kcal: 2000 });

    // Cele już ustawione na tym telefonie — kopia ich nie nadpisuje.
    y.setGoals({ kcal: 2600 });
    y.mergeDump({ meals: [], goals: { kcal: 1800 } });
    expect(y.getGoals()).toEqual({ kcal: 2600 });
  });
});
