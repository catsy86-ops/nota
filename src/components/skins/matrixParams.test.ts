import { describe, it, expect } from "vitest";
import { MATRIX_FPS, MATRIX_FRAME_MS, matrixColumns, matrixFontPx } from "./matrixParams";

describe("deszcz matrix — parametry", () => {
  it("liczba kolumn pokrywa szerokość ekranu, najmniej jedna", () => {
    expect(matrixColumns(390, 16)).toBe(25);
    expect(matrixColumns(1440, 16)).toBe(90);
    expect(matrixColumns(0, 16)).toBe(1);
  });

  it("na palcu znaki są większe, więc kolumn jest mniej", () => {
    expect(matrixFontPx(true)).toBeGreaterThan(matrixFontPx(false));
    expect(matrixColumns(390, matrixFontPx(true))).toBeLessThan(matrixColumns(390, matrixFontPx(false)));
  });

  it("ogranicza liczbę klatek — nie 60 fps w tle", () => {
    expect(MATRIX_FPS).toBe(24);
    expect(MATRIX_FRAME_MS).toBeCloseTo(41.67, 1);
  });
});
