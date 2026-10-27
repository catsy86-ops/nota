import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { YearHeatmap } from "./YearHeatmap";

// G4.3: mapa roku ma komórkę dla każdego dnia roku; dzień z pracą jest wypełniony kolorem marki.
describe("mapa roku (G4.3)", () => {
  it("jedna komórka na każdy dzień roku (365 dla 2026)", () => {
    const { container } = render(<YearHeatmap year={2026} dayMinutes={new Map()} />);
    expect(container.querySelectorAll("rect")).toHaveLength(365);
  });

  it("dzień z pracą dostaje kolor marki, a jego tytuł podaje godziny", () => {
    const { container } = render(<YearHeatmap year={2026} dayMinutes={new Map([["2026-10-05", 8 * 60]])} />);
    const cell = container.querySelector("rect[style*='primary']") as SVGRectElement | null;
    expect(cell).not.toBeNull();
    expect(cell?.querySelector("title")?.textContent).toContain("8,0 h");
  });
});
