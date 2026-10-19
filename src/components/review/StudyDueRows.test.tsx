import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { JournalEntry } from "@/lib/study/yStudy";

// Stan Praca podmieniamy atrapą: test sprawdza renderowanie wierszy, nie dane dziennika.
const fixture: { journal: JournalEntry[]; sites: Record<string, unknown> } = { journal: [], sites: {} };
vi.mock("@/lib/study/data", () => ({ useStudyReady: () => true }));
vi.mock("@/lib/study/store", () => ({ useStudy: () => fixture }));

import { StudyDueRows } from "./StudyDueRows";

// Stała godzina: serwis z terminem „dziś” (lokalnie) jest należny.
const now = new Date(2026, 9, 19, 12, 0).getTime();
const today = "2026-10-19";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});
afterAll(() => vi.useRealTimers());
afterEach(() => {
  cleanup();
  fixture.journal = [];
  fixture.sites = {};
});

describe("StudyDueRows", () => {
  it("bez terminów z Praca nic nie pokazuje", () => {
    const { container } = render(<StudyDueRows onOpenStudy={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("pokazuje serwis należny dziś, tylko do odczytu, z przyciskiem do Pracy", () => {
    fixture.sites = {
      s1: { id: "s1", name: "Kopernika", archived: undefined, shortages: [], service: [{ id: "c1", text: "przegląd kotła", at: now - 86400000, due: today }] },
    };
    let opened = 0;
    render(<StudyDueRows onOpenStudy={() => opened++} />);
    expect(screen.getByTestId("study-due-count").textContent).toBe("1");
    expect(screen.getByText("Serwis: Kopernika")).toBeTruthy();
    expect(screen.getByText("przegląd kotła")).toBeTruthy();
    // Brak przycisków wykonania — tylko odnośnik do działu.
    expect(screen.queryByRole("button", { name: /załatw|zrobion|odhacz/i })).toBeNull();
    screen.getByRole("button", { name: /Otwórz Pracę/ }).click();
    expect(opened).toBe(1);
  });

  it("zamówienie bez dostawy dłużej niż 3 dni pojawia się w wierszach", () => {
    fixture.sites = {
      s2: {
        id: "s2",
        name: "Lipowa",
        shortages: [{ id: "x1", text: "kolano 16", qty: "2 szt.", status: "ordered", at: now - 10 * 86400000, changed: now - 5 * 86400000 }],
        service: [],
      },
    };
    render(<StudyDueRows onOpenStudy={() => {}} />);
    expect(screen.getByText("Zamówienie bez dostawy: Lipowa")).toBeTruthy();
  });
});
