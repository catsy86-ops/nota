import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { TodayDueList } from "./TodayDueList";
import type { Note } from "@/hooks/useNotes";

afterEach(cleanup);

const HOUR = 3600_000;
const now = Date.now();

/** Minimalna notatka do listy terminów — reszta pól bez znaczenia dla grupowania. */
function note(id: string, reminder: number | null, over: Partial<Note> = {}): Note {
  return { id, title: `T-${id}`, content: "", reminder, archived: false, trashed: false, ...over } as unknown as Note;
}

describe("TodayDueList", () => {
  it("pokazuje zaległe i dzisiejsze, a pomija przyszłe, archiwum i kosz", () => {
    const notes = [
      note("late", now - 2 * HOUR),
      note("soon", now + 60 * 60_000 * 0.5),
      note("week", now + 3 * 24 * HOUR),
      note("arch", now - HOUR, { archived: true }),
      note("bin", now - HOUR, { trashed: true }),
    ];
    render(<TodayDueList notes={notes} onOpen={() => {}} onOpenReminders={() => {}} />);
    const overdue = screen.getByText("Zaległe").closest("[data-due-group]") as HTMLElement;
    expect(within(overdue).getByText("T-late")).toBeTruthy();
    expect(screen.queryByText("T-week")).toBeNull();
    expect(screen.queryByText("T-arch")).toBeNull();
    expect(screen.queryByText("T-bin")).toBeNull();
    expect(screen.getByTestId("today-due-count").textContent).toBe("2");
  });

  it("gdy nic nie czeka, mówi to wprost", () => {
    render(<TodayDueList notes={[note("week", now + 3 * 24 * HOUR)]} onOpen={() => {}} onOpenReminders={() => {}} />);
    expect(screen.getByText("Nic nie czeka na dziś.")).toBeTruthy();
  });

  it("ucina do czterech pozycji z grupy i wskazuje resztę", () => {
    const notes = Array.from({ length: 6 }, (_, i) => note(`o${i}`, now - (i + 1) * HOUR));
    render(<TodayDueList notes={notes} onOpen={() => {}} onOpenReminders={() => {}} />);
    expect(screen.getByText("i jeszcze 2 w Przypomnieniach")).toBeTruthy();
    expect(screen.getByTestId("today-due-count").textContent).toBe("6");
  });

  it("kliknięcie notatki zgłasza jej id", () => {
    const got: string[] = [];
    render(<TodayDueList notes={[note("x", now - HOUR)]} onOpen={(id) => got.push(id)} onOpenReminders={() => {}} />);
    screen.getByText("T-x").click();
    expect(got).toEqual(["x"]);
  });
});
