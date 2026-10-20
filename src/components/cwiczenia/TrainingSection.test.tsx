import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PlanDay, TrainingEntry } from "@/lib/training/model";
import { localDayKey } from "@/lib/dayDone";

const { fixture, addEntryMock } = vi.hoisted(() => ({
  fixture: { entries: [] as TrainingEntry[], plans: [] as PlanDay[] },
  addEntryMock: vi.fn(),
}));
vi.mock("@/lib/training/store", () => ({
  useTrainingEntries: () => fixture.entries,
  useTrainingPlans: () => fixture.plans,
  addTrainingEntry: (input: unknown) => addEntryMock(input),
  removeTrainingEntry: vi.fn(() => null),
  restoreTrainingEntry: vi.fn(),
  addPlanDay: vi.fn(() => null),
  removePlanDay: vi.fn(() => null),
  restorePlanDay: vi.fn(),
}));

import { TrainingSection } from "./TrainingSection";

afterEach(() => {
  cleanup();
  fixture.entries = [];
  fixture.plans = [];
  addEntryMock.mockReset();
});

describe("TrainingSection", () => {
  it("bez planu mówi to wprost", () => {
    render(<TrainingSection />);
    expect(screen.getByText("Nie masz jeszcze planu dni. Dodaj go poniżej.")).toBeTruthy();
  });

  it("zapis serii wysyła ćwiczenie i wartości; pusty wiersz jest pomijany", () => {
    addEntryMock.mockReturnValue({ id: "t1" });
    render(<TrainingSection />);
    fireEvent.change(screen.getByLabelText("Powtórki, seria 1"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Ciężar kg, seria 1"), { target: { value: "12,5" } });
    fireEvent.change(screen.getByLabelText("Powtórki, seria 2"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz serie" }));
    expect(addEntryMock).toHaveBeenCalledWith(expect.objectContaining({
      exerciseId: "klatka-hantle-plasko",
      sets: [{ reps: 10, kg: 12.5 }, { reps: 8 }],
    }));
  });

  it("powtórki ułamkowe blokują zapis", () => {
    render(<TrainingSection />);
    fireEvent.change(screen.getByLabelText("Powtórki, seria 1"), { target: { value: "8,5" } });
    expect((screen.getByRole("button", { name: "Zapisz serie" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText("Powtórki, seria 1").getAttribute("aria-invalid")).toBe("true");
  });

  it("„Użyj ostatnich” przepisuje serie z ostatniej sesji tego ćwiczenia", () => {
    fixture.entries = [{
      id: "old", day: "2026-10-18", exerciseId: "klatka-hantle-plasko", note: "", created: 1,
      sets: [{ reps: 10, kg: 20 }, { reps: 8, kg: 22 }],
    }];
    render(<TrainingSection />);
    expect(screen.getByText(/Ostatnio \(18\.10\): 10×20 kg, 8×22 kg/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Użyj ostatnich" }));
    expect((screen.getByLabelText("Powtórki, seria 2") as HTMLInputElement).value).toBe("8");
    expect((screen.getByLabelText("Ciężar kg, seria 2") as HTMLInputElement).value).toBe("22");
  });

  it("dzisiejsze wpisy są na liście, a progres pokazuje rekord", () => {
    fixture.entries = [{
      id: "today", day: localDayKey(), exerciseId: "biceps-mlotkowe", note: "", created: 1, time: "19:00",
      sets: [{ reps: 10, kg: 14 }],
    }];
    render(<TrainingSection />);
    expect(screen.getByTestId("training-today").textContent).toContain("Uginanie młotkowe");
    expect(screen.getByTestId("training-progress").textContent).toContain("rekord 14 kg");
  });
});
