import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ReviewWalkthrough from "./ReviewWalkthrough";
import type { Note } from "@/hooks/useNotes";

afterEach(cleanup);

const note = (id: string, title: string): Note =>
  ({ id, title, content: "treść", updatedAt: Date.now(), checklist: [] }) as unknown as Note;

function setup() {
  const onArchive = vi.fn();
  const onTrash = vi.fn();
  render(
    <ReviewWalkthrough
      queue={[{ note: note("a", "Pierwsza"), category: "stale" }, { note: note("b", "Druga"), category: "stale" }]}
      onArchive={onArchive}
      onTrash={onTrash}
      onFinish={() => {}}
      onClose={() => {}}
    />,
  );
  return { onArchive, onTrash };
}

describe("ReviewWalkthrough — kosz wymaga potwierdzenia", () => {
  it("skrót D otwiera potwierdzenie i nie przenosi od razu", () => {
    const { onTrash } = setup();
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("Przenieść do kosza?")).toBeTruthy();
    expect(onTrash).not.toHaveBeenCalled();
  });

  it("po potwierdzeniu notatka idzie do kosza", () => {
    const { onTrash } = setup();
    fireEvent.keyDown(window, { key: "d" });
    fireEvent.click(screen.getByRole("button", { name: "Przenieś do kosza" }));
    expect(onTrash).toHaveBeenCalledWith("a");
  });

  it("skróty K i A działają bez potwierdzenia (archiwum ma „Cofnij”)", () => {
    const { onArchive } = setup();
    fireEvent.keyDown(window, { key: "a" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onArchive).toHaveBeenCalledWith("a");
  });

  it("pod otwartym potwierdzeniem skróty nie przechodzą dalej", () => {
    const { onArchive } = setup();
    fireEvent.keyDown(window, { key: "d" });
    fireEvent.keyDown(window, { key: "a" });
    expect(onArchive).not.toHaveBeenCalled();
  });
});
