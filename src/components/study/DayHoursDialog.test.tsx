import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { JournalEntry } from "@/lib/study/yStudy";

const setDayHours = vi.fn();
let journal: JournalEntry[] = [];
const sites = { a: { name: "Dom A" }, b: { name: "Dom B" }, c: { name: "Dom C" } };
const dir = [{ id: "a", name: "Dom A" }, { id: "b", name: "Dom B" }, { id: "c", name: "Dom C" }, { id: "z", name: "Stary dom", archived: 1 }];
vi.mock("@/lib/study/store", () => ({
  useStudy: () => ({ journal, sites }),
  useSiteDirectory: () => dir,
  setDayHours: (...a: unknown[]) => setDayHours(...a),
}));
// Dzień ma 8 godzin pracy z Grafiku.
vi.mock("@/lib/shifts", () => ({ useShifts: () => null }));
vi.mock("@/lib/study/report", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/study/report")>();
  return { ...real, workOn: () => ({ minutes: 480, label: "Dniówka" }) };
});
vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }));

const { DayHoursDialog } = await import("./DayHoursDialog");

const DAY = "2026-10-14";
const entry = (id: string, siteId: string, name: string): JournalEntry => ({
  id, at: new Date(2026, 9, 14, 12).getTime(), kind: "ok", topic: null, text: "praca",
  site: name, siteId, checked: [], images: [], fittings: [],
});

beforeEach(() => {
  setDayHours.mockReset();
  journal = [entry("e1", "a", "Dom A"), entry("e2", "b", "Dom B")];
});

afterEach(() => {
  cleanup();
});

describe("DayHoursDialog — godziny na budowach", () => {
  it("pokazuje pola dla budów z wpisami tego dnia", () => {
    render(<DayHoursDialog day={DAY} label="środa" onOpenChange={vi.fn()} />);
    expect(screen.getByLabelText("Godziny: Dom A")).toBeInTheDocument();
    expect(screen.getByLabelText("Godziny: Dom B")).toBeInTheDocument();
  });

  it("zapis sumuje wpisane godziny na minuty", () => {
    const onOpenChange = vi.fn();
    render(<DayHoursDialog day={DAY} label="środa" onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByLabelText("Godziny: Dom A"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Godziny: Dom B"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));

    expect(setDayHours).toHaveBeenCalledWith(DAY, { a: 360, b: 120 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("błędny format blokuje zapis i pokazuje podpowiedź", () => {
    render(<DayHoursDialog day={DAY} label="środa" onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Godziny: Dom A"), { target: { value: "sześć" } });

    expect(screen.getByRole("alert")).toHaveTextContent(/Wpisz godziny/);
    expect(screen.getByRole("button", { name: "Zapisz" })).toBeDisabled();
  });

  it("przy jednym pustym polu pokazuje resztę dnia", () => {
    render(<DayHoursDialog day={DAY} label="środa" onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Godziny: Dom A"), { target: { value: "6" } });

    expect(screen.getByTestId("day-hours-left")).toHaveTextContent(/Puste pole dostanie resztę/);
  });

  it("wpisano więcej niż Grafik ma godzin — ostrzeżenie", () => {
    render(<DayHoursDialog day={DAY} label="środa" onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Godziny: Dom A"), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText("Godziny: Dom B"), { target: { value: "2" } });

    expect(screen.getByTestId("day-hours-left")).toHaveTextContent(/więcej niż w Grafiku/);
  });

  it("„+ Budowa” dokłada budowę bez wpisu (bez archiwum); pusta nic nie zapisuje i nie zabiera reszty dnia", () => {
    render(<DayHoursDialog day={DAY} label="środa" onOpenChange={vi.fn()} />);
    const add = screen.getByRole("combobox", { name: "Dodaj budowę bez wpisu tego dnia" });
    expect(screen.queryByRole("option", { name: "Stary dom" })).toBeNull();
    fireEvent.change(add, { target: { value: "c" } });
    expect(screen.getByLabelText("Godziny: Dom C")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Godziny: Dom A"), { target: { value: "6" } });
    // Jedno puste pole z wpisem (Dom B) dostaje resztę — dołożona Dom C się nie liczy.
    expect(screen.getByTestId("day-hours-left")).toHaveTextContent(/Puste pole dostanie resztę/);
    fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(setDayHours).toHaveBeenCalledWith(DAY, { a: 360, b: 0 });
  });

  it("z karty budowy: ta budowa na liście mimo braku wpisu, dzień do zmiany", () => {
    journal = [];
    render(<DayHoursDialog day={DAY} siteId="c" onOpenChange={vi.fn()} />);
    expect(screen.getByLabelText("Dzień")).toHaveValue(DAY);
    fireEvent.change(screen.getByLabelText("Godziny: Dom C"), { target: { value: "3,5" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(setDayHours).toHaveBeenCalledWith(DAY, { c: 210 });
  });
});
