import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { DietGoals, Meal } from "@/lib/diet/model";
import { localDayKey } from "@/lib/dayDone";

// Magazyn diety podmieniamy atrapą: test sprawdza sekcję, nie Yjs.
const { fixture, addMealMock, setGoalsMock, removeMock } = vi.hoisted(() => ({
  fixture: { meals: [] as Meal[], goals: {} as DietGoals },
  addMealMock: vi.fn(),
  setGoalsMock: vi.fn(),
  removeMock: vi.fn((_id?: unknown) => null),
}));
vi.mock("@/lib/diet/store", () => ({
  useMeals: () => fixture.meals,
  useDietGoals: () => fixture.goals,
  addMeal: (input: unknown) => addMealMock(input),
  removeMeal: (id: unknown) => removeMock(id),
  restoreMeal: vi.fn(),
  setDietGoals: (g: unknown) => setGoalsMock(g),
}));

import { DietSection } from "./DietSection";

afterEach(() => {
  cleanup();
  fixture.meals = [];
  fixture.goals = {};
  addMealMock.mockReset();
  setGoalsMock.mockReset();
});

const today = () => localDayKey();
const meal = (id: string, over: Partial<Meal> = {}): Meal => ({ id, day: today(), text: id, created: 1, ...over });

describe("DietSection", () => {
  it("bez posiłków mówi to wprost", () => {
    render(<DietSection />);
    expect(screen.getByText("Dziś bez posiłków. Dodaj pierwszy poniżej.")).toBeTruthy();
  });

  it("sumuje dzień i pokazuje, ile posiłków nie ma kalorii", () => {
    fixture.meals = [meal("Owsianka", { time: "08:00", kcal: 450, protein: 15 }), meal("Kefir", { time: "10:00", protein: 10 })];
    fixture.goals = { kcal: 2400 };
    render(<DietSection />);
    const summary = screen.getByTestId("diet-summary");
    expect(within(summary).getByText("450 kcal", { exact: false })).toBeTruthy();
    expect(within(summary).getByText("z 2400 kcal", { exact: false })).toBeTruthy();
    expect(within(summary).getByText("1 posiłek bez kalorii")).toBeTruthy();
    expect(within(summary).getByText("25 g", { exact: false })).toBeTruthy();
  });

  it("dodawanie posiłku wysyła opis i liczby", () => {
    addMealMock.mockReturnValue({ id: "m1" });
    render(<DietSection />);
    fireEvent.change(screen.getByRole("textbox", { name: "Co zjedzono" }), { target: { value: "Kurczak z ryżem" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Kalorie (kcal)" }), { target: { value: "600" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Białko (g)" }), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj posiłek" }));
    expect(addMealMock).toHaveBeenCalledWith(expect.objectContaining({ text: "Kurczak z ryżem", kcal: 600, protein: 45 }));
  });

  it("nie-liczba w polu kalorii blokuje zapis", () => {
    render(<DietSection />);
    fireEvent.change(screen.getByRole("textbox", { name: "Co zjedzono" }), { target: { value: "Coś" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Kalorie (kcal)" }), { target: { value: "dużo" } });
    expect((screen.getByRole("button", { name: "Dodaj posiłek" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("textbox", { name: "Kalorie (kcal)" }).getAttribute("aria-invalid")).toBe("true");
  });

  it("zapis celów wysyła liczby, puste pole to brak celu", () => {
    render(<DietSection />);
    fireEvent.change(screen.getByRole("textbox", { name: "Cel kalorii (kcal)" }), { target: { value: "2200" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz cele" }));
    expect(setGoalsMock).toHaveBeenCalledWith({ kcal: 2200, protein: undefined });
  });
});
