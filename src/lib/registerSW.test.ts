import { describe, expect, it } from "vitest";
import { canApplyWaitingUpdate, UPDATE_CHECK_MS } from "./registerSW";

describe("canApplyWaitingUpdate", () => {
  it("podmienia wersję, gdy karta jest schowana, czeka wersja i nie ma niezapisanej pracy", () => {
    expect(canApplyWaitingUpdate({ hidden: true, unsaved: false, waiting: true })).toBe(true);
  });

  it("nie przeładowuje otwartej karty", () => {
    expect(canApplyWaitingUpdate({ hidden: false, unsaved: false, waiting: true })).toBe(false);
  });

  it("nie zgubi niezapisanej pracy", () => {
    expect(canApplyWaitingUpdate({ hidden: true, unsaved: true, waiting: true })).toBe(false);
  });

  it("nic nie robi bez oczekującej wersji", () => {
    expect(canApplyWaitingUpdate({ hidden: true, unsaved: false, waiting: false })).toBe(false);
  });
});

describe("sprawdzanie aktualizacji", () => {
  it("co godzinę, gdy karta stoi otwarta", () => {
    expect(UPDATE_CHECK_MS).toBe(60 * 60_000);
  });
});
