import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { DebtEntry } from "@/lib/debts/model";

// Magazyn Długów podmieniamy atrapą: test sprawdza widok i przepływy, nie Yjs.
const { fixture, updateMock, addMock, removeMock } = vi.hoisted(() => ({
  fixture: { entries: [] as DebtEntry[] },
  updateMock: vi.fn(),
  addMock: vi.fn(),
  removeMock: vi.fn(),
}));
vi.mock("@/lib/debts/store", () => ({
  useDebts: () => fixture.entries,
  addDebt: (input: unknown) => addMock(input),
  addDebtFromText: vi.fn(() => null),
  removeDebt: (id: unknown) => removeMock(id),
  restoreDebt: vi.fn(),
  updateDebt: (entry: unknown) => updateMock(entry),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { DebtsView } from "./DebtsView";

afterEach(() => {
  cleanup();
  fixture.entries = [];
  updateMock.mockReset();
  addMock.mockReset();
  removeMock.mockReset();
});

const debt = (id: string, person: string, kind: DebtEntry["kind"], amount: number, over: Partial<DebtEntry> = {}): DebtEntry =>
  ({ id, person, kind, amount, at: "2026-10-10", note: "", created: 1, ...over }) as DebtEntry;

describe("DebtsView — podsumowanie i osoby", () => {
  it("sumuje to, co nam winni, i to, co my jesteśmy winni", () => {
    fixture.entries = [
      debt("1", "Ania", "lent", 10_000),
      debt("2", "Marek", "borrowed", 4_000),
    ];
    render(<DebtsView />);
    expect(screen.getByTestId("debts-owed").textContent).toBe("100,00 zł");
    expect(screen.getByTestId("debts-owe").textContent).toBe("40,00 zł");
  });

  it("pusta lista mówi, co zrobić", () => {
    render(<DebtsView />);
    expect(screen.getByText("Jeszcze nikogo tu nie ma")).toBeTruthy();
  });
});

describe("DebtsView — edycja wpisu", () => {
  it("poprawka kwoty zapisuje się w tym samym wpisie (ten sam id, kwota w groszach)", () => {
    fixture.entries = [debt("e1", "Ania", "lent", 10_000, { note: "zaliczka" })];
    render(<DebtsView />);
    fireEvent.click(screen.getByRole("button", { name: /Ania/ }));
    fireEvent.click(screen.getByRole("button", { name: /Edytuj wpis: Pożyczyłem/ }));
    const form = screen.getByRole("form", { name: "Edycja wpisu" });
    const amount = within(form).getByLabelText("Kwota (zł)") as HTMLInputElement;
    expect(amount.value).toBe("100,00");
    fireEvent.change(amount, { target: { value: "150,50" } });
    fireEvent.click(within(form).getByRole("button", { name: "Zapisz zmiany" }));
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ id: "e1", person: "Ania", kind: "lent", amount: 15_050, note: "zaliczka" }));
  });

  it("zła kwota blokuje zapis i pokazuje komunikat", () => {
    fixture.entries = [debt("e1", "Ania", "lent", 10_000)];
    render(<DebtsView />);
    fireEvent.click(screen.getByRole("button", { name: /Ania/ }));
    fireEvent.click(screen.getByRole("button", { name: /Edytuj wpis/ }));
    const form = screen.getByRole("form", { name: "Edycja wpisu" });
    fireEvent.change(within(form).getByLabelText("Kwota (zł)"), { target: { value: "dużo" } });
    fireEvent.click(within(form).getByRole("button", { name: "Zapisz zmiany" }));
    expect(updateMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("kwotę większą od zera");
  });

  it("zmiana rodzaju wpisu idzie do zapisu", () => {
    fixture.entries = [debt("e1", "Ania", "lent", 10_000)];
    render(<DebtsView />);
    fireEvent.click(screen.getByRole("button", { name: /Ania/ }));
    fireEvent.click(screen.getByRole("button", { name: /Edytuj wpis/ }));
    const form = screen.getByRole("form", { name: "Edycja wpisu" });
    fireEvent.click(within(form).getByRole("radio", { name: "Oddał mi" }));
    fireEvent.click(within(form).getByRole("button", { name: "Zapisz zmiany" }));
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ kind: "repaid" }));
  });
});

describe("DebtsView — rozliczenie", () => {
  it("„Oddał całość” dodaje wpis wyrównujący saldo", () => {
    fixture.entries = [debt("e1", "Ania", "lent", 10_000)];
    render(<DebtsView />);
    fireEvent.click(screen.getByRole("button", { name: /Ania/ }));
    fireEvent.click(screen.getByRole("button", { name: /Oddał całość/ }));
    expect(addMock).toHaveBeenCalledWith({ person: "Ania", kind: "repaid", amount: 10_000 });
  });
});

describe("DebtsView — ukrywanie kwot (plan długów 3.3)", () => {
  it("przełącznik chowa kwoty w podsumowaniu i na liście, a potem je przywraca", () => {
    fixture.entries = [debt("1", "Ania", "lent", 10_000)];
    render(<DebtsView />);
    fireEvent.click(screen.getByRole("button", { name: "Ukryj kwoty" }));
    expect(screen.getByTestId("debts-owed").textContent).toBe("•••");
    expect(screen.getByRole("button", { name: /Ania/ }).textContent).toContain("•••");
    expect(screen.queryByText(/100,00 zł/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pokaż kwoty" }));
    expect(screen.getByTestId("debts-owed").textContent).toBe("100,00 zł");
  });
});
