import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ScheduleSwitcher } from "./ScheduleSwitcher";
import { MAIN_SCHEDULE_ID } from "@/lib/shifts/yShifts";

const picker = () => screen.getByLabelText("Wybierz grafik") as HTMLSelectElement;

describe("przełącznik grafików (4.4)", () => {
  it("startuje na grafiku głównym, którego nie da się usunąć", () => {
    render(<ScheduleSwitcher />);
    expect(picker().value).toBe(MAIN_SCHEDULE_ID);
    expect(screen.queryByRole("button", { name: /Usuń grafik/ })).toBeNull();
  });

  it("dodaje nowy grafik i przełącza na niego; powrót na główny przywraca jego widok", () => {
    render(<ScheduleSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /Nowy grafik/ }));
    fireEvent.change(screen.getByLabelText("Nazwa nowego grafiku"), { target: { value: "Dorobek" } });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj" }));

    const options = Array.from(picker().options).map((o) => o.textContent);
    expect(options).toContain("Dorobek");
    expect(picker().options[picker().selectedIndex].textContent).toBe("Dorobek");
    expect(screen.getByRole("button", { name: /Usuń grafik Dorobek/ })).toBeTruthy();

    fireEvent.change(picker(), { target: { value: MAIN_SCHEDULE_ID } });
    expect(picker().value).toBe(MAIN_SCHEDULE_ID);
  });

  it("zmiana nazwy zapisuje się w liście wyboru", () => {
    render(<ScheduleSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /Nowy grafik/ }));
    fireEvent.change(screen.getByLabelText("Nazwa nowego grafiku"), { target: { value: "Stary" } });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj" }));
    fireEvent.click(screen.getByRole("button", { name: /Zmień nazwę grafiku Stary/ }));
    fireEvent.change(screen.getByLabelText("Nowa nazwa grafiku"), { target: { value: "Nowy" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(Array.from(picker().options).map((o) => o.textContent)).toContain("Nowy");
  });
});

describe("nakładka grafiku (4.1)", () => {
  it("lista nakładki pomija aktywny grafik i zaczyna od „Bez nakładki”", () => {
    const onOverlayChange = () => {};
    render(<ScheduleSwitcher overlayId={null} onOverlayChange={onOverlayChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Nowy grafik/ }));
    fireEvent.change(screen.getByLabelText("Nazwa nowego grafiku"), { target: { value: "Partner" } });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj" }));
    const overlay = screen.getByLabelText("Nakładka grafiku") as HTMLSelectElement;
    const labels = Array.from(overlay.options).map((o) => o.textContent);
    expect(labels[0]).toBe("Bez nakładki");
    expect(labels).toContain("Nakładka: Główny");
    expect(labels.some((l) => l === "Nakładka: Partner")).toBe(false);
  });
});
