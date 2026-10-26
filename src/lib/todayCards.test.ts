import { describe, expect, it, vi } from "vitest";

async function loadFresh(raw: string | null) {
  localStorage.clear();
  if (raw !== null) localStorage.setItem("kaczy.todayCards.v1", raw);
  vi.resetModules();
  return import("./todayCards");
}

describe("karty na Dziś (D-2)", () => {
  it("bez zapisu obie karty są włączone", async () => {
    const m = await loadFresh(null);
    expect(m.todayCardsStore.get()).toEqual({ brainTraining: true, weeklyReview: true });
  });

  it("wyłączenie jednej karty nie rusza drugiej", async () => {
    const m = await loadFresh(null);
    m.setTodayCard("weeklyReview", false);
    expect(m.todayCardsStore.get()).toEqual({ brainTraining: true, weeklyReview: false });
  });

  it("uszkodzone pola wracają do domyślnych, nie wyłączają karty przypadkiem", async () => {
    const m = await loadFresh(JSON.stringify({ brainTraining: "nie", weeklyReview: false }));
    expect(m.todayCardsStore.get()).toEqual({ brainTraining: true, weeklyReview: false });
  });
});
