import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ReviewWalkthrough from "./ReviewWalkthrough";
import type { Note } from "@/hooks/useNotes";
import { setConfirmPref } from "@/lib/confirmPrefs";

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
  beforeEach(() => { setConfirmPref("trash", true); setConfirmPref("archive", true); });
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

  it("skrót A otwiera potwierdzenie archiwizacji; po potwierdzeniu notatka idzie do archiwum", () => {
    const { onArchive } = setup();
    fireEvent.keyDown(window, { key: "a" });
    expect(screen.getByText("Zarchiwizować?")).toBeTruthy();
    expect(onArchive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Archiwizuj" }));
    expect(onArchive).toHaveBeenCalledWith("a");
  });

  it("skrót K działa bez potwierdzenia (nic nie zmienia)", () => {
    const { onArchive, onTrash } = setup();
    fireEvent.keyDown(window, { key: "k" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onArchive).not.toHaveBeenCalled();
    expect(onTrash).not.toHaveBeenCalled();
  });

  it("pod otwartym potwierdzeniem skróty nie przechodzą dalej", () => {
    const { onArchive } = setup();
    fireEvent.keyDown(window, { key: "d" });
    fireEvent.keyDown(window, { key: "a" });
    expect(onArchive).not.toHaveBeenCalled();
  });
});

describe("ReviewWalkthrough — bez pytania (plan 3.1)", () => {
  beforeEach(() => { setConfirmPref("trash", false); setConfirmPref("archive", false); });

  it("skrót D przenosi od razu, bez potwierdzenia (jest „Cofnij”)", () => {
    const { onTrash } = setup();
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onTrash).toHaveBeenCalledWith("a");
  });
});
