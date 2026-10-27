import { describe, it, expect } from "vitest";
import {
  cleanTextSizeStep,
  nextTextSizeStep,
  textScale,
  TEXT_SIZE_STEPS,
  DEFAULT_TEXT_SIZE_STEP,
} from "./textSize";

describe("rozmiar tekstu — krok", () => {
  it("domyślny krok to 100 %", () => {
    expect(TEXT_SIZE_STEPS[DEFAULT_TEXT_SIZE_STEP]).toBe(100);
    expect(textScale(DEFAULT_TEXT_SIZE_STEP)).toBe(1);
  });

  it("zapis spoza zakresu, ułamek i nie-liczba wracają do domyślnego", () => {
    expect(cleanTextSizeStep(-1)).toBe(DEFAULT_TEXT_SIZE_STEP);
    expect(cleanTextSizeStep(TEXT_SIZE_STEPS.length)).toBe(DEFAULT_TEXT_SIZE_STEP);
    expect(cleanTextSizeStep(1.5)).toBe(DEFAULT_TEXT_SIZE_STEP);
    expect(cleanTextSizeStep("2")).toBe(DEFAULT_TEXT_SIZE_STEP);
    expect(cleanTextSizeStep(null)).toBe(DEFAULT_TEXT_SIZE_STEP);
  });

  it("poprawne kroki przechodzą bez zmian", () => {
    for (let i = 0; i < TEXT_SIZE_STEPS.length; i++) expect(cleanTextSizeStep(i)).toBe(i);
  });

  it("zmiana kroku jest przycinana do zakresu, bez zawijania", () => {
    expect(nextTextSizeStep(0, -1)).toBe(0);
    expect(nextTextSizeStep(TEXT_SIZE_STEPS.length - 1, 1)).toBe(TEXT_SIZE_STEPS.length - 1);
    expect(nextTextSizeStep(1, 1)).toBe(2);
    expect(nextTextSizeStep(2, -1)).toBe(1);
  });

  it("mnożnik to procent podzielony przez 100", () => {
    expect(textScale(0)).toBeCloseTo(0.9);
    expect(textScale(4)).toBeCloseTo(1.4);
  });
});
