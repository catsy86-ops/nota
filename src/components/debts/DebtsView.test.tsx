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
const { shareMock } = vi.hoisted(() => ({ shareMock: vi.fn(async () => "copied") }));
vi.mock("@/lib/shareOrCopy", () => ({ shareOrCopy: shareMock }));

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
    expect(addMock).toHaveBeenCalledWith({ person: "Ania", kind: "repaid", amount: 10_000, settle: true });
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

describe("DebtsView — plan Długów, Etap 1", () => {
  it("1.3: pasek spłaty także przy samym „Pożyczyłem od”, z kwotą strony salda", () => {
    fixture.entries = [debt("1", "Marek", "borrowed", 4_000)];
    render(<DebtsView />);
    expect(screen.getByRole("img", { name: "Oddano 0% z 40,00 zł" })).toBeTruthy();
  });

  it("1.6: dwa „całość” z dwóch telefonów — baner i usunięcie drugiego wpisu", () => {
    fixture.entries = [
      debt("l", "Ania", "lent", 10_000, { created: 1 }),
      debt("s1", "Ania", "repaid", 10_000, { created: 1_000, settle: true }),
      debt("s2", "Ania", "repaid", 10_000, { created: 20_000, settle: true }),
    ];
    removeMock.mockImplementation(() => fixture.entries[2]);
    render(<DebtsView />);
    fireEvent.click(screen.getByRole("button", { name: /Ania/ }));
    expect(screen.getByTestId("debts-double-settle").textContent).toContain("Rozliczono dwa razy");
    expect(screen.queryByRole("button", { name: /całość/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Usuń drugi wpis" }));
    expect(removeMock).toHaveBeenCalledWith("s2");
  });

  it("1.5: edycja zdejmuje termin zwrotu z notatki, gdy pole wyczyszczone", () => {
    const at = new Date(2030, 0, 15, 9).getTime();
    fixture.entries = [debt("1", "Ania", "lent", 10_000, { dueNoteId: "n1" })];
    updateMock.mockImplementation((e: DebtEntry) => e);
    const reminders = { get: vi.fn(() => at), clear: vi.fn(() => at), restore: vi.fn(), has: vi.fn(() => true), remove: vi.fn() };
    render(<DebtsView reminders={reminders} />);
    fireEvent.click(screen.getByRole("button", { name: /Ania/ }));
    fireEvent.click(screen.getByRole("button", { name: /Edytuj wpis/ }));
    const form = screen.getByRole("form", { name: "Edycja wpisu" });
    const due = within(form).getByLabelText(/Termin zwrotu/) as HTMLInputElement;
    expect(due.value).toBe("2030-01-15");
    fireEvent.change(due, { target: { value: "" } });
    fireEvent.click(within(form).getByRole("button", { name: "Zapisz zmiany" }));
    expect(reminders.clear).toHaveBeenCalledWith("n1");
  });

  it("1.5 i 1.2: termin dodany w edycji tworzy notatkę z etykietą „długi”", () => {
    fixture.entries = [debt("1", "Ania", "lent", 10_000)];
    updateMock.mockImplementation((e: DebtEntry) => e);
    const addReminderNote = vi.fn(() => "n9");
    render(<DebtsView addReminderNote={addReminderNote} />);
    fireEvent.click(screen.getByRole("button", { name: /Ania/ }));
    fireEvent.click(screen.getByRole("button", { name: /Edytuj wpis/ }));
    const form = screen.getByRole("form", { name: "Edycja wpisu" });
    fireEvent.change(within(form).getByLabelText(/Termin zwrotu/), { target: { value: "2099-05-01" } });
    fireEvent.click(within(form).getByRole("button", { name: "Zapisz zmiany" }));
    expect(addReminderNote).toHaveBeenCalledWith("Zwrot od Ania: 100,00 zł", "", new Date(2099, 4, 1, 9).getTime(), ["długi"]);
    expect(updateMock).toHaveBeenLastCalledWith(expect.objectContaining({ dueNoteId: "n9" }));
  });

  it("1.5: zła kwota w edycji jest oznaczona w polu", () => {
    fixture.entries = [debt("1", "Ania", "lent", 10_000)];
    render(<DebtsView />);
    fireEvent.click(screen.getByRole("button", { name: /Ania/ }));
    fireEvent.click(screen.getByRole("button", { name: /Edytuj wpis/ }));
    const form = screen.getByRole("form", { name: "Edycja wpisu" });
    fireEvent.change(within(form).getByLabelText("Kwota (zł)"), { target: { value: "x" } });
    fireEvent.click(within(form).getByRole("button", { name: "Zapisz zmiany" }));
    expect(within(form).getByLabelText("Kwota (zł)").getAttribute("aria-invalid")).toBe("true");
  });

  it("przegląd: zmiana rodzaju na „Oddał mi” zdejmuje przypomnienie pożyczki", () => {
    const at = new Date(2030, 0, 15, 9).getTime();
    fixture.entries = [debt("1", "Ania", "lent", 10_000, { dueNoteId: "n1" })];
    updateMock.mockImplementation((e: DebtEntry) => e);
    const reminders = { get: vi.fn(() => at), clear: vi.fn(() => at), restore: vi.fn(), has: vi.fn(() => true), remove: vi.fn() };
    render(<DebtsView reminders={reminders} />);
    fireEvent.click(screen.getByRole("button", { name: /Ania/ }));
    fireEvent.click(screen.getByRole("button", { name: /Edytuj wpis/ }));
    const form = screen.getByRole("form", { name: "Edycja wpisu" });
    fireEvent.click(within(form).getByRole("radio", { name: "Oddał mi" }));
    fireEvent.click(within(form).getByRole("button", { name: "Zapisz zmiany" }));
    expect(reminders.clear).toHaveBeenCalledWith("n1");
  });

  it("przegląd: usunięta notatka terminu — nowy termin tworzy nową notatkę, „Cofnij” ją usuwa", async () => {
    const { toast } = await import("sonner");
    fixture.entries = [debt("1", "Ania", "lent", 10_000, { dueNoteId: "gone" })];
    updateMock.mockImplementation((e: DebtEntry) => e);
    const reminders = { get: vi.fn(() => null), clear: vi.fn(() => null), restore: vi.fn(), has: vi.fn(() => false), remove: vi.fn() };
    const addReminderNote = vi.fn(() => "n2");
    render(<DebtsView reminders={reminders} addReminderNote={addReminderNote} />);
    fireEvent.click(screen.getByRole("button", { name: /Ania/ }));
    fireEvent.click(screen.getByRole("button", { name: /Edytuj wpis/ }));
    const form = screen.getByRole("form", { name: "Edycja wpisu" });
    fireEvent.change(within(form).getByLabelText(/Termin zwrotu/), { target: { value: "2099-05-01" } });
    fireEvent.click(within(form).getByRole("button", { name: "Zapisz zmiany" }));
    expect(reminders.restore).not.toHaveBeenCalled();
    expect(addReminderNote).toHaveBeenCalled();
    const call = vi.mocked(toast.success).mock.calls.at(-1)!;
    (call[1] as unknown as { action: { onClick: () => void } }).action.onClick();
    expect(reminders.remove).toHaveBeenCalledWith("n2");
  });
});

describe("DebtsView — plan Długów, Etap 2", () => {
  it("2.4: rozliczeni zwinięci na dole, rozwijani przyciskiem", () => {
    fixture.entries = [debt("1", "Ania", "lent", 10_000), debt("2", "Ola", "lent", 5_000), debt("3", "Ola", "repaid", 5_000)];
    render(<DebtsView />);
    const toggle = screen.getByRole("button", { name: "Rozliczeni (1)" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: /^Ola/ })).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /^Ola/ })).toBeTruthy();
  });

  it("2.5: przy ponad 8 osobach szukanie bez polskich znaków", () => {
    fixture.entries = ["Łukasz", "Anna", "Beata", "Celina", "Darek", "Edek", "Franek", "Gosia", "Henio"].map((n, i) => debt(String(i), n, "lent", 1_000));
    render(<DebtsView />);
    fireEvent.change(screen.getByPlaceholderText("Szukaj osoby"), { target: { value: "lukasz" } });
    expect(screen.getByRole("button", { name: /^Łukasz/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Anna/ })).toBeNull();
  });

  it("2.2: historia z nagłówkami miesięcy", () => {
    fixture.entries = [debt("1", "Ania", "lent", 10_000, { at: "2026-10-10" }), debt("2", "Ania", "repaid", 2_000, { at: "2026-11-01", created: 2 })];
    render(<DebtsView />);
    fireEvent.click(screen.getByRole("button", { name: /Ania/ }));
    const history = screen.getByRole("group", { name: "Historia" });
    expect(within(history).getAllByRole("heading").map((h) => h.textContent)).toEqual(["listopad 2026", "październik 2026"]);
  });

  it("2.1: „Wpis z {imię}” otwiera formularz z tą osobą", () => {
    fixture.entries = [debt("1", "Ania", "lent", 10_000)];
    render(<DebtsView />);
    fireEvent.click(screen.getByRole("button", { name: /Ania/ }));
    fireEvent.click(screen.getByRole("button", { name: "Wpis z Ania" }));
    const form = screen.getByRole("form", { name: "Nowy wpis" });
    expect((within(form).getByLabelText("Kto") as HTMLInputElement).value).toBe("Ania");
  });
});

describe("DebtsView — plan Długów, Etap 3", () => {
  it("3.2: „Wyślij” przekazuje rozliczenie osoby do udostępnienia albo schowka", async () => {
    fixture.entries = [debt("1", "Ania", "lent", 10_000)];
    render(<DebtsView />);
    fireEvent.click(screen.getByRole("button", { name: /Ania/ }));
    fireEvent.click(screen.getByRole("button", { name: "Wyślij" }));
    expect(shareMock).toHaveBeenCalledWith({ title: "Ania — rozliczenie", text: expect.stringContaining("Do oddania: 100,00 zł") });
  });
});

describe("DebtsView — plan Długów, Etap 4", () => {
  it("4.1: pasek proporcji z opisem, gdy są kwoty po obu stronach", () => {
    fixture.entries = [debt("1", "Ania", "lent", 15_000), debt("2", "Marek", "borrowed", 5_000)];
    render(<DebtsView />);
    expect(screen.getByRole("img", { name: "Proporcja: 75% to, co nam winni, 25% to, co jesteś winien" })).toBeTruthy();
  });

  it("4.4: pusty stan ma jedno wezwanie „Dodaj pierwszy wpis”", () => {
    render(<DebtsView />);
    // Magazyn formularza jest trwały, jak w przeglądarce: po poprzednim teście może być otwarty — zwijamy go.
    const collapse = screen.queryByRole("button", { name: "Zwiń formularz" });
    if (collapse) fireEvent.click(collapse);
    expect(screen.getByRole("button", { name: "Dodaj pierwszy wpis" })).toBeTruthy();
    expect(screen.queryByTestId("debts-ratio")).toBeNull();
  });

  it("4.2: kółko z inicjałem w barwie osoby, ukryte dla czytnika", () => {
    fixture.entries = [debt("1", "Ania", "lent", 1_000)];
    const { container } = render(<DebtsView />);
    const avatar = container.querySelector(".debt-avatar")!;
    expect(avatar.textContent).toBe("A");
    expect(avatar.getAttribute("aria-hidden")).toBe("true");
    expect(avatar.getAttribute("data-avatar")).toBeTruthy();
  });
});

