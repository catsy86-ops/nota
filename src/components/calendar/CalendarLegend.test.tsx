import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendarLegend } from "./CalendarLegend";

describe("CalendarLegend (K4.1)", () => {
  it("jest zwinięta i opisuje kształty stanów dnia", () => {
    render(<CalendarLegend />);
    const legend = screen.getByTestId("calendar-legend");
    expect(legend.tagName).toBe("DETAILS");
    expect(legend).not.toHaveAttribute("open");
    expect(screen.getByText("Zaległy termin (kwadrat)")).toBeInTheDocument();
    expect(screen.getByText("Prognoza serii, jeszcze nie zapisany termin")).toBeInTheDocument();
  });
});
