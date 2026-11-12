import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PlanDay, TrainingEntry } from "@/lib/training/model";
import { localDayKey } from "@/lib/dayDone";
import { setRestSeconds } from "@/lib/training/restPrefs";
import { addDaysToKey } from "@/lib/week";

const { fixture, addEntryMock, setReminderMock, setEquipmentMock, notesMock } = vi.hoisted(() => ({
  fixture: { entries: [] as TrainingEntry[], plans: [] as PlanDay[], reminder: null as { time: string; noteId?: string } | null, equipment: {} as { dumbbellMaxKg?: number } },
  addEntryMock: vi.fn(),
  setReminderMock: vi.fn(),
  setEquipmentMock: vi.fn(),
  notesMock: { notes: [] as { id: string }[], archivedNotes: [] as { id: string }[], trashedNotes: [] as { id: string }[], addNote: vi.fn(() => "note-1"), updateNote: vi.fn(), trashNote: vi.fn(), restoreFromTrash: vi.fn() },
}));
vi.mock("@/hooks/NotesProvider", () => ({ useNotesContext: () => notesMock }));
vi.mock("@/lib/training/store", () => ({
  useTrainingEntries: () => fixture.entries,
  useCustomExercises: () => [],
  addCustomExercise: () => null,
  removeCustomExercise: () => false,
  useTrainingPlans: () => fixture.plans,
  useTrainingReminder: () => fixture.reminder,
  setTrainingReminder: (r: unknown) => setReminderMock(r),
  useTrainingEquipment: () => fixture.equipment,
  setTrainingEquipment: (e: unknown) => setEquipmentMock(e),
  addTrainingEntry: (input: unknown) => addEntryMock(input),
  removeTrainingEntry: vi.fn(() => null),
  restoreTrainingEntry: vi.fn(),
  addPlanDay: vi.fn(() => null),
  removePlanDay: vi.fn(() => null),
  restorePlanDay: vi.fn(),
}));

const { hapticMock } = vi.hoisted(() => ({ hapticMock: vi.fn() }));
vi.mock("@/lib/haptics", () => ({ haptic: (kind: string) => hapticMock(kind) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));

import { act } from "@testing-library/react";
import { TrainingSection } from "./TrainingSection";

afterEach(() => {
  cleanup();
  fixture.entries = [];
  fixture.plans = [];
  fixture.reminder = null;
  fixture.equipment = {};
  setEquipmentMock.mockReset();
  addEntryMock.mockReset();
  hapticMock.mockClear();
  setReminderMock.mockReset();
  notesMock.notes = [];
  notesMock.addNote.mockClear();
  notesMock.updateNote.mockClear();
  notesMock.trashNote.mockClear();
});

describe("TrainingSection", () => {
  it("bez planu mówi to wprost", () => {
    render(<TrainingSection />);
    expect(screen.getByText("Nie masz jeszcze planu dni. Dodaj go poniżej.")).toBeTruthy();
  });

  it("pole „Dzień”: „Wczoraj” zapisuje trening na wczorajszy dzień bez godziny i wraca do „Dziś” (2.5)", () => {
    addEntryMock.mockReturnValue({ id: "t1" });
    render(<TrainingSection />);
    fireEvent.change(screen.getByLabelText("Powtórki, seria 1"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Wczoraj" }));
    fireEvent.click(screen.getByRole("button", { name: "Zapisz serie" }));
    const arg = addEntryMock.mock.calls[0][0] as { day?: string; time?: string };
    expect(arg.day).toBe(addDaysToKey(localDayKey(), -1));
    expect(arg.time).toBeUndefined();
    expect(screen.getByRole("button", { name: "Dziś" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("czas przerwy (1.2): wybór z listy jest zapamiętany, a po zapisie serii startuje licznik na wybrany czas", () => {
    addEntryMock.mockReturnValue({ id: "t1" });
    render(<TrainingSection />);
    fireEvent.click(screen.getByRole("radio", { name: "3 min" }));
    expect(screen.getByRole("radio", { name: "3 min" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.change(screen.getByLabelText("Powtórki, seria 1"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz serie" }));
    expect(screen.getByTestId("rest-timer").textContent).toMatch(/3:00|2:5\d/);
    setRestSeconds(90);
  });

  it("przerwa (4.4): „+30 s” wydłuża licznik, „Pomiń” go zamyka", () => {
    addEntryMock.mockReturnValue({ id: "t1" });
    render(<TrainingSection />);
    fireEvent.change(screen.getByLabelText("Powtórki, seria 1"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz serie" }));
    expect(screen.getByTestId("rest-timer").textContent).toMatch(/1:30|1:29/);
    fireEvent.click(screen.getByRole("button", { name: "+30 s" }));
    expect(screen.getByTestId("rest-timer").textContent).toMatch(/2:00|1:59/);
    fireEvent.click(screen.getByRole("button", { name: "Pomiń" }));
    expect(screen.queryByTestId("rest-timer")).toBeNull();
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

  it("cięższy ciężar niż dotychczas = nowy rekord; pierwszy zapis ćwiczenia nim nie jest (3.3)", async () => {
    const { toast } = await import("sonner");
    fixture.entries = [{ id: "old", day: "2026-10-01", exerciseId: "klatka-hantle-plasko", sets: [{ reps: 8, kg: 20 }], note: "", created: 1 }];
    addEntryMock.mockReturnValue({ id: "t2" });
    render(<TrainingSection />);
    fireEvent.change(screen.getByLabelText("Powtórki, seria 1"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Ciężar kg, seria 1"), { target: { value: "22,5" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz serie" }));
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(expect.stringContaining("Nowy rekord"));
  });

  it("lżejsza seria albo pierwsze ćwiczenie — bez komunikatu o rekordzie", async () => {
    const { toast } = await import("sonner");
    vi.mocked(toast.success).mockClear();
    fixture.entries = [{ id: "old", day: "2026-10-01", exerciseId: "klatka-hantle-plasko", sets: [{ reps: 8, kg: 20 }], note: "", created: 1 }];
    addEntryMock.mockReturnValue({ id: "t3" });
    render(<TrainingSection />);
    fireEvent.change(screen.getByLabelText("Powtórki, seria 1"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Ciężar kg, seria 1"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz serie" }));
    expect(vi.mocked(toast.success)).not.toHaveBeenCalledWith(expect.stringContaining("Nowy rekord"));
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

  it("przypomnienie o 18:00 tworzy notatkę z dziennym powtarzaniem i zapisuje jej id", () => {
    render(<TrainingSection />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Przypominaj o treningu/ }));
    expect(notesMock.addNote).toHaveBeenCalledWith("Trening — 18:00–20:00", expect.any(String), "default", ["ćwiczenia"], expect.any(Number));
    expect(notesMock.updateNote).toHaveBeenCalledWith("note-1", { reminderRepeat: "daily" });
    expect(setReminderMock).toHaveBeenCalledWith({ time: "18:00", noteId: "note-1" });
  });

  it("wyłączenie przypomnienia sprząta jego notatkę", () => {
    fixture.reminder = { time: "18:00", noteId: "old-note" };
    notesMock.notes = [{ id: "old-note" }];
    render(<TrainingSection />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Przypominaj o treningu/ }));
    expect(notesMock.trashNote).toHaveBeenCalledWith("old-note");
    expect(setReminderMock).toHaveBeenCalledWith(null);
  });

  it("po zapisie serii pokazuje się przerwa 1:30", () => {
    addEntryMock.mockReturnValue({ id: "t1" });
    render(<TrainingSection />);
    fireEvent.change(screen.getByLabelText("Powtórki, seria 1"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz serie" }));
    expect(screen.getByTestId("rest-timer").textContent).toContain("1:30");
    fireEvent.click(screen.getByRole("button", { name: "Pomiń" }));
    expect(screen.queryByTestId("rest-timer")).toBeNull();
  });

  it("sprzęt: zapis największego ciężaru hantli", () => {
    render(<TrainingSection />);
    fireEvent.change(screen.getByLabelText("Największy ciężar hantli (kg)"), { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz sprzęt" }));
    expect(setEquipmentMock).toHaveBeenCalledWith({ dumbbellMaxKg: 24 });
  });

  it("ciężar ponad hantle pokazuje ostrzeżenie, ale zapis nadal jest możliwy", () => {
    fixture.equipment = { dumbbellMaxKg: 20 };
    render(<TrainingSection />);
    fireEvent.change(screen.getByLabelText("Ciężar kg, seria 1"), { target: { value: "26" } });
    fireEvent.change(screen.getByLabelText("Powtórki, seria 1"), { target: { value: "8" } });
    expect(screen.getByRole("status").textContent).toContain("powyżej Twoich hantli (20 kg)");
    expect((screen.getByRole("button", { name: "Zapisz serie" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("progres z co najmniej dwiema sesjami pokazuje wykres rekordów", () => {
    fixture.entries = [
      { id: "a", day: "2026-10-10", exerciseId: "klatka-hantle-plasko", note: "", created: 1, sets: [{ reps: 10, kg: 20 }] },
      { id: "b", day: "2026-10-15", exerciseId: "klatka-hantle-plasko", note: "", created: 2, sets: [{ reps: 10, kg: 22 }] },
    ];
    render(<TrainingSection />);
    expect(screen.getByRole("img", { name: "Rekordy kolejnych sesji: 20, 22 kg" })).toBeTruthy();
    // 4.3: ostatnia wartość jest podpisana, a gdy jest też rekordem — dopisek „rekord”.
    expect(screen.getByTestId("training-progress").textContent).toContain("22 kg · rekord");
  });

  it("4.3: gdy rekord był wcześniej, podpis ostatniej wartości nie mówi „rekord”", () => {
    fixture.entries = [
      { id: "a", day: "2026-10-10", exerciseId: "klatka-hantle-plasko", note: "", created: 1, sets: [{ reps: 10, kg: 24 }] },
      { id: "b", day: "2026-10-15", exerciseId: "klatka-hantle-plasko", note: "", created: 2, sets: [{ reps: 10, kg: 20 }] },
    ];
    render(<TrainingSection />);
    const text = screen.getByTestId("training-progress").textContent ?? "";
    expect(text).toContain("20 kg");
    expect(text).not.toContain("20 kg · rekord");
  });

  it("koniec przerwy wibruje i zamyka licznik", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    try {
      addEntryMock.mockReturnValue({ id: "t2" });
      render(<TrainingSection />);
      fireEvent.change(screen.getByLabelText("Powtórki, seria 1"), { target: { value: "10" } });
      fireEvent.click(screen.getByRole("button", { name: "Zapisz serie" }));
      expect(hapticMock).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(91_000); });
      expect(hapticMock).toHaveBeenCalledWith("success");
      expect(screen.queryByTestId("rest-timer")).toBeNull();
    } finally {
      vi.useRealTimers();
      hapticMock.mockClear();
    }
  });

  it("wybór dnia planu ustawia ćwiczenie i liczbę serii", () => {
    fixture.plans = [{ id: "p1", name: "Ramiona", exerciseIds: ["biceps-mlotkowe"], targetSets: 2, targetReps: 12, created: 1 }];
    render(<TrainingSection />);
    fireEvent.change(screen.getByRole("combobox", { name: "Dzień planu" }), { target: { value: "p1" } });
    expect((screen.getByRole("combobox", { name: "Ćwiczenie" }) as HTMLSelectElement).value).toBe("biceps-mlotkowe");
    expect((screen.getByLabelText("Powtórki, seria 2") as HTMLInputElement).value).toBe("12");
    expect(screen.queryByLabelText("Powtórki, seria 3")).toBeNull();
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
