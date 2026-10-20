import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { TodayDueList } from "./TodayDueList";
import type { Note } from "@/hooks/useNotes";

afterEach(cleanup);

const HOUR = 3600_000;
// Stały „teraz” — wynik nie zależy od godziny uruchomienia testów.
const now = new Date(2026, 9, 14, 12, 0).getTime();

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});
afterAll(() => vi.useRealTimers());

/** Minimalna notatka do listy terminów — reszta pól bez znaczenia dla grupowania. */
function note(id: string, reminder: number | null, over: Partial<Note> = {}): Note {
  return { id, title: `T-${id}`, content: "", reminder, archived: false, trashed: false, ...over } as unknown as Note;
}

describe("TodayDueList", () => {
  it("pokazuje zaległe i dzisiejsze, a pomija przyszłe i kosz; archiwum liczy się jak reszta", () => {
    const notes = [
      note("late", now - 2 * HOUR),
      note("soon", now + 60 * 60_000 * 0.5),
      note("week", now + 3 * 24 * HOUR),
      note("arch", now - HOUR, { archived: true }),
      note("bin", now - HOUR, { trashed: true }),
    ];
    render(<TodayDueList notes={notes} onOpen={() => {}} onOpenReminders={() => {}} />);
    // „late” (2 h temu) to przegapione; „arch” (1 h temu) wciąż zaległe.
    const missed = screen.getByText("Przegapione").closest("[data-due-group]") as HTMLElement;
    expect(within(missed).getByText("T-late")).toBeTruthy();
    const overdue = screen.getByText("Zaległe").closest("[data-due-group]") as HTMLElement;
    expect(within(overdue).getByText("T-arch")).toBeTruthy();
    expect(screen.queryByText("T-week")).toBeNull();
    expect(screen.queryByText("T-bin")).toBeNull();
    expect(screen.getByTestId("today-due-count").textContent).toBe("3");
  });

  it("gdy nic nie czeka, mówi to wprost", () => {
    render(<TodayDueList notes={[note("week", now + 3 * 24 * HOUR)]} onOpen={() => {}} onOpenReminders={() => {}} />);
    expect(screen.getByText("Nic nie czeka na dziś.")).toBeTruthy();
  });

  it("ucina do czterech pozycji z grupy i wskazuje resztę", () => {
    const notes = Array.from({ length: 6 }, (_, i) => note(`o${i}`, now - (i + 1) * HOUR));
    render(<TodayDueList notes={notes} onOpen={() => {}} onOpenReminders={() => {}} />);
    expect(screen.getByText("i jeszcze 1 w Przypomnieniach")).toBeTruthy();
    expect(screen.getByTestId("today-due-count").textContent).toBe("6");
  });

  it("po zmianie doby przypomnienie, które minęło, przechodzi z „dziś” do zaległych", () => {
    // Termin za pół godziny: na liście „dziś”. Potem zegar idzie dalej i karta wraca na pierwszy plan.
    render(<TodayDueList notes={[note("x", now + HOUR / 2)]} onOpen={() => {}} onOpenReminders={() => {}} />);
    expect(document.querySelector('[data-due-group="today"]')).toBeTruthy();
    act(() => {
      vi.setSystemTime(now + 2 * HOUR);
      window.dispatchEvent(new Event("focus"));
    });
    expect(document.querySelector('[data-due-group="today"]')).toBeNull();
    expect(screen.getByText("T-x")).toBeTruthy();
  });

  it("kliknięcie notatki zgłasza jej id", () => {
    const got: string[] = [];
    render(<TodayDueList notes={[note("x", now - HOUR)]} onOpen={(id) => got.push(id)} onOpenReminders={() => {}} />);
    screen.getByText("T-x").click();
    expect(got).toEqual(["x"]);
  });
});
