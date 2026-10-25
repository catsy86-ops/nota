import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RangeCopyDialog } from "./RangeCopyDialog";

describe("okno kopiowania zakresu (4.2)", () => {
  it("nie pozwala skopiować, gdy „do” jest przed „od”", () => {
    const onCopy = vi.fn();
    render(<RangeCopyDialog open onOpenChange={() => {}} defaultFrom="2026-10-05" onCopy={onCopy} />);
    fireEvent.change(screen.getByLabelText("Do dnia"), { target: { value: "2026-10-01" } });
    expect(screen.getByRole("button", { name: "Skopiuj zakres" })).toBeDisabled();
    expect(screen.getByText(/nie może być przed/)).toBeTruthy();
    expect(onCopy).not.toHaveBeenCalled();
  });

  it("przekazuje zakres i początek kopii", () => {
    const onCopy = vi.fn();
    render(<RangeCopyDialog open onOpenChange={() => {}} defaultFrom="2026-10-05" onCopy={onCopy} />);
    fireEvent.change(screen.getByLabelText("Do dnia"), { target: { value: "2026-10-09" } });
    fireEvent.change(screen.getByLabelText("Kopia zaczyna się"), { target: { value: "2026-10-19" } });
    fireEvent.click(screen.getByRole("button", { name: "Skopiuj zakres" }));
    expect(onCopy).toHaveBeenCalledWith("2026-10-05", "2026-10-09", "2026-10-19");
  });
});
