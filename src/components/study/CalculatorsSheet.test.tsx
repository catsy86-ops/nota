import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { CalculatorsButton } from "./CalculatorsSheet";

/** Otwiera kalkulatory z przycisku i zwraca okno. */
function openCalculators() {
  render(<CalculatorsButton />);
  fireEvent.click(screen.getByRole("button", { name: /Kalkulatory/ }));
  return screen.getByTestId("calculators");
}

afterEach(() => {
  cleanup();
});

describe("CalculatorsSheet — kalkulatory budowy", () => {
  it("spadek: długość i procent dają różnicę wysokości w cm", () => {
    const dialog = openCalculators();
    const slope = within(dialog).getByRole("region", { name: "Spadek kanalizacji" });
    fireEvent.change(within(slope).getByLabelText(/Długość/), { target: { value: "8" } });

    // Domyślnie 2% → 8 m × 2% = 16 cm.
    expect(within(slope).getByTestId("calc-slope-result")).toHaveTextContent("16");
    fireEvent.click(within(slope).getByRole("button", { name: "3%" }));
    expect(within(slope).getByTestId("calc-slope-result")).toHaveTextContent("24");
  });

  it("spadek poza typowym zakresem dostaje podpowiedź", () => {
    const dialog = openCalculators();
    const slope = within(dialog).getByRole("region", { name: "Spadek kanalizacji" });
    fireEvent.change(within(slope).getByLabelText(/Długość/), { target: { value: "8" } });
    fireEvent.click(within(slope).getByRole("button", { name: "Spadek w %" }));
    fireEvent.change(within(slope).getByLabelText(/Różnica wysokości/), { target: { value: "4" } });

    // 4 cm na 8 m = 0,5% — poniżej 2–3%.
    expect(within(slope).getByTestId("calc-slope-result")).toHaveTextContent("0,5");
    expect(within(slope).getByRole("note")).toHaveTextContent(/Mniej niż typowe 2–3%/);
  });

  it("próba wodna: 1,5 × robocze i manometr +50%", () => {
    const dialog = openCalculators();
    const test = within(dialog).getByRole("region", { name: "Próba wodna" });
    fireEvent.change(within(test).getByLabelText(/Ciśnienie robocze/), { target: { value: "4" } });

    expect(within(test).getByTestId("calc-test-result")).toHaveTextContent("6");
    expect(within(test).getByTestId("calc-gauge-result")).toHaveTextContent("9");
  });

  it("pojemność: wybrana rura × długość; kolejny odcinek sumuje się", () => {
    const dialog = openCalculators();
    const volume = within(dialog).getByRole("region", { name: "Pojemność instalacji" });
    // Rura 16×2 ma 12 mm w świetle: π·(12/200)²·10 m ≈ 1,13 l.
    fireEvent.change(within(volume).getByRole("textbox", { name: "Rura 1: długość" }), { target: { value: "10" } });
    expect(within(volume).getByTestId("calc-volume-total")).toHaveTextContent("1,13");

    fireEvent.click(within(volume).getByRole("button", { name: /Kolejny odcinek/ }));
    fireEvent.change(within(volume).getByRole("textbox", { name: "Rura 2: długość" }), { target: { value: "10" } });
    expect(within(volume).getByTestId("calc-volume-total")).toHaveTextContent("2,26");
  });

  it("usunięcie ostatniego odcinka jest zablokowane", () => {
    const dialog = openCalculators();
    const volume = within(dialog).getByRole("region", { name: "Pojemność instalacji" });
    expect(within(volume).getByRole("button", { name: "Usuń rurę 1" })).toBeDisabled();
  });

  it("„Inna rura” pokazuje pola średnicy i długości", () => {
    const dialog = openCalculators();
    const volume = within(dialog).getByRole("region", { name: "Pojemność instalacji" });
    fireEvent.change(within(volume).getByRole("combobox", { name: "Rura 1" }), { target: { value: "custom" } });
    expect(within(volume).getByRole("textbox", { name: "Rura 1: średnica wewnętrzna" })).toBeInTheDocument();
  });
});
